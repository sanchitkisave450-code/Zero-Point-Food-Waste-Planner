from fastapi import FastAPI, APIRouter, HTTPException, File, UploadFile
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import requests
import base64
import cv2
import numpy as np
import pytesseract
from PIL import Image
import io
import re
from dateutil import parser as date_parser


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ===========================
# Pydantic Models
# ===========================

class InventoryItemCreate(BaseModel):
    name: str
    category: str  # Fridge, Pantry, Freezer, Leftovers
    quantity: str
    unit: str
    expiry_date: Optional[str] = None
    barcode: Optional[str] = None
    image: Optional[str] = None  # base64
    brand: Optional[str] = None
    added_date: datetime = Field(default_factory=datetime.utcnow)

class InventoryItem(InventoryItemCreate):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    days_to_expire: Optional[int] = None
    urgency: Optional[str] = None  # critical, warning, safe

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[str] = None
    unit: Optional[str] = None
    expiry_date: Optional[str] = None
    image: Optional[str] = None
    brand: Optional[str] = None

class BarcodeResponse(BaseModel):
    found: bool
    product: Optional[Dict[str, Any]] = None
    barcode: str

class OCRExpiryRequest(BaseModel):
    image: str  # base64 encoded image

class OCRExpiryResponse(BaseModel):
    success: bool
    expiry_date: Optional[str] = None
    confidence: str
    detected_text: Optional[str] = None

class Recipe(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    name: str
    ingredients: List[str]
    available_ingredients: List[str]
    missing_ingredients: List[str]
    steps: List[str]
    cooking_time: int  # in minutes
    difficulty: str  # quick, medium, long
    cuisine: str
    meal_type: str  # breakfast, lunch, dinner, snack
    waste_prevented: int  # number of items used

class ShoppingListItem(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    name: str
    quantity: str
    unit: str
    priority: str  # must-buy, optional
    is_duplicate: bool = False
    notes: Optional[str] = None
    checked: bool = False

class MealPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    date: str
    meal_type: str  # breakfast, lunch, dinner
    recipe_id: Optional[str] = None
    recipe_name: str


# ===========================
# Helper Functions
# ===========================

def calculate_urgency(expiry_date_str: Optional[str]) -> tuple:
    """Calculate days to expire and urgency level"""
    if not expiry_date_str:
        return None, "unknown"
    
    try:
        expiry = datetime.fromisoformat(expiry_date_str.replace('Z', '+00:00'))
        today = datetime.utcnow()
        days_diff = (expiry - today).days
        
        if days_diff < 0:
            urgency = "expired"
        elif days_diff == 0:
            urgency = "critical"
        elif days_diff <= 3:
            urgency = "critical"
        elif days_diff <= 7:
            urgency = "warning"
        else:
            urgency = "safe"
        
        return days_diff, urgency
    except:
        return None, "unknown"


def preprocess_image_for_ocr(image_bytes: bytes) -> np.ndarray:
    """Preprocess image for better OCR results"""
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Denoise
    denoised = cv2.fastNlMeansDenoising(thresh, None, 10, 7, 21)
    
    return denoised


def extract_expiry_date(text: str) -> Optional[str]:
    """Extract expiry date from OCR text using regex and keywords"""
    text = text.upper()
    
    # Keywords to look for
    keywords = ['EXP', 'EXPIRY', 'BEST BEFORE', 'USE BY', 'BBD', 'BEST BY', 'MFG', 'MFD', 'PACKED ON']
    
    # Common date patterns
    patterns = [
        r'\b(\d{2})[/-](\d{2})[/-](\d{4})\b',  # DD/MM/YYYY or DD-MM-YYYY
        r'\b(\d{4})[/-](\d{2})[/-](\d{2})\b',  # YYYY/MM/DD or YYYY-MM-DD
        r'\b(\d{2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})\b',  # DD MMM YYYY
        r'\b(\d{2})[/-](\d{4})\b',  # MM/YYYY
    ]
    
    # Try to find date near keywords
    for keyword in keywords:
        if keyword in text:
            # Get text around keyword (50 chars after)
            idx = text.find(keyword)
            context = text[idx:idx+50]
            
            for pattern in patterns:
                match = re.search(pattern, context)
                if match:
                    try:
                        # Parse the date
                        date_str = match.group(0)
                        parsed_date = date_parser.parse(date_str, dayfirst=True)
                        return parsed_date.isoformat()
                    except:
                        continue
    
    # If no keyword found, try to find any date in text
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                date_str = match.group(0)
                parsed_date = date_parser.parse(date_str, dayfirst=True)
                return parsed_date.isoformat()
            except:
                continue
    
    return None


# ===========================
# Basic Indian Recipe Database
# ===========================

RECIPE_DATABASE = [
    {
        "name": "Vegetable Khichdi",
        "ingredients": ["rice", "lentils", "onion", "tomato", "potato", "carrot", "peas", "ginger", "turmeric"],
        "steps": ["Wash rice and lentils", "Pressure cook with vegetables and spices for 3 whistles", "Serve hot with ghee"],
        "cooking_time": 30,
        "difficulty": "quick",
        "cuisine": "Indian",
        "meal_type": "lunch"
    },
    {
        "name": "Dal Tadka",
        "ingredients": ["lentils", "onion", "tomato", "garlic", "ginger", "cumin", "turmeric", "ghee"],
        "steps": ["Pressure cook lentils", "Prepare tadka with cumin and spices", "Mix and simmer for 5 minutes"],
        "cooking_time": 25,
        "difficulty": "quick",
        "cuisine": "Indian",
        "meal_type": "lunch"
    },
    {
        "name": "Poha",
        "ingredients": ["poha", "onion", "potato", "peanuts", "turmeric", "curry leaves", "lemon"],
        "steps": ["Wash poha and keep aside", "Sauté onions and potatoes", "Add poha and spices", "Garnish with lemon"],
        "cooking_time": 15,
        "difficulty": "quick",
        "cuisine": "Indian",
        "meal_type": "breakfast"
    },
    {
        "name": "Vegetable Pulao",
        "ingredients": ["rice", "carrot", "peas", "beans", "onion", "bay leaf", "cumin", "ghee"],
        "steps": ["Wash and soak rice", "Sauté vegetables", "Add rice and water", "Cook till done"],
        "cooking_time": 30,
        "difficulty": "medium",
        "cuisine": "Indian",
        "meal_type": "lunch"
    },
    {
        "name": "Paneer Bhurji",
        "ingredients": ["paneer", "onion", "tomato", "capsicum", "turmeric", "chili powder", "oil"],
        "steps": ["Crumble paneer", "Sauté onions and tomatoes", "Add paneer and spices", "Cook for 5 minutes"],
        "cooking_time": 20,
        "difficulty": "quick",
        "cuisine": "Indian",
        "meal_type": "breakfast"
    },
    {
        "name": "Aloo Paratha",
        "ingredients": ["wheat flour", "potato", "onion", "green chili", "coriander", "ghee"],
        "steps": ["Make dough", "Prepare potato filling", "Stuff and roll paratha", "Cook on tawa with ghee"],
        "cooking_time": 40,
        "difficulty": "medium",
        "cuisine": "Indian",
        "meal_type": "breakfast"
    },
    {
        "name": "Curd Rice",
        "ingredients": ["rice", "curd", "milk", "cucumber", "coriander", "mustard seeds", "curry leaves"],
        "steps": ["Cook rice and mash", "Mix with curd and milk", "Add cucumber and tempering"],
        "cooking_time": 20,
        "difficulty": "quick",
        "cuisine": "Indian",
        "meal_type": "lunch"
    },
    {
        "name": "Mixed Vegetable Curry",
        "ingredients": ["potato", "carrot", "beans", "peas", "onion", "tomato", "coconut", "spices"],
        "steps": ["Chop all vegetables", "Pressure cook with spices", "Prepare gravy", "Simmer for 10 minutes"],
        "cooking_time": 35,
        "difficulty": "medium",
        "cuisine": "Indian",
        "meal_type": "dinner"
    },
]


# ===========================
# API Routes
# ===========================

@api_router.get("/")
async def root():
    return {"message": "Food Waste Zero-Point Planner API"}


# Inventory Routes
@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item: InventoryItemCreate):
    """Create a new inventory item"""
    item_dict = item.dict()
    item_dict['id'] = str(ObjectId())
    
    # Calculate urgency
    days_to_expire, urgency = calculate_urgency(item.expiry_date)
    item_dict['days_to_expire'] = days_to_expire
    item_dict['urgency'] = urgency
    
    await db.inventory.insert_one(item_dict)
    return InventoryItem(**item_dict)


@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(category: Optional[str] = None, sort_by: str = "expiry"):
    """Get all inventory items, optionally filtered by category"""
    query = {}
    if category:
        query['category'] = category
    
    items = await db.inventory.find(query).to_list(1000)
    
    # Update urgency for all items
    for item in items:
        days_to_expire, urgency = calculate_urgency(item.get('expiry_date'))
        item['days_to_expire'] = days_to_expire
        item['urgency'] = urgency
    
    # Sort by expiry date
    if sort_by == "expiry":
        items.sort(key=lambda x: x.get('days_to_expire') if x.get('days_to_expire') is not None else 9999)
    
    return [InventoryItem(**item) for item in items]


@api_router.get("/inventory/{item_id}", response_model=InventoryItem)
async def get_inventory_item(item_id: str):
    """Get a specific inventory item"""
    item = await db.inventory.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    days_to_expire, urgency = calculate_urgency(item.get('expiry_date'))
    item['days_to_expire'] = days_to_expire
    item['urgency'] = urgency
    
    return InventoryItem(**item)


@api_router.put("/inventory/{item_id}", response_model=InventoryItem)
async def update_inventory_item(item_id: str, item_update: InventoryItemUpdate):
    """Update an inventory item"""
    update_data = {k: v for k, v in item_update.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.inventory.update_one({"id": item_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    updated_item = await db.inventory.find_one({"id": item_id})
    days_to_expire, urgency = calculate_urgency(updated_item.get('expiry_date'))
    updated_item['days_to_expire'] = days_to_expire
    updated_item['urgency'] = urgency
    
    return InventoryItem(**updated_item)


@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str):
    """Delete an inventory item"""
    result = await db.inventory.delete_one({"id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Item deleted successfully"}


# Barcode Routes
@api_router.get("/barcode/{barcode}", response_model=BarcodeResponse)
async def fetch_product_by_barcode(barcode: str):
    """Fetch product information from OpenFoodFacts API"""
    try:
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data.get('status') == 1:
            product = data.get('product', {})
            normalized_product = {
                "name": product.get('product_name', 'Unknown Product'),
                "brand": product.get('brands', ''),
                "category": product.get('categories', ''),
                "quantity": product.get('quantity', ''),
                "image_url": product.get('image_url', ''),
                "ingredients": product.get('ingredients_text', ''),
                "nutrition": {
                    "energy": product.get('nutriments', {}).get('energy-kcal_100g'),
                    "fat": product.get('nutriments', {}).get('fat_100g'),
                    "protein": product.get('nutriments', {}).get('proteins_100g'),
                }
            }
            
            return BarcodeResponse(found=True, product=normalized_product, barcode=barcode)
        else:
            return BarcodeResponse(found=False, barcode=barcode)
    
    except Exception as e:
        logger.error(f"Error fetching barcode data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching product data: {str(e)}")


# OCR Routes
@api_router.post("/ocr/expiry", response_model=OCRExpiryResponse)
async def extract_expiry_from_image(request: OCRExpiryRequest):
    """Extract expiry date from image using OCR"""
    try:
        # Decode base64 image
        image_data = request.image
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        
        # Preprocess image
        preprocessed = preprocess_image_for_ocr(image_bytes)
        
        # Perform OCR
        text = pytesseract.image_to_string(preprocessed)
        
        # Extract date
        expiry_date = extract_expiry_date(text)
        
        if expiry_date:
            return OCRExpiryResponse(
                success=True,
                expiry_date=expiry_date,
                confidence="high",
                detected_text=text[:200]
            )
        else:
            return OCRExpiryResponse(
                success=False,
                confidence="low",
                detected_text=text[:200]
            )
    
    except Exception as e:
        logger.error(f"OCR Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


# Recipe Routes
@api_router.get("/recipes/suggestions", response_model=List[Recipe])
async def get_recipe_suggestions(max_results: int = 5):
    """Get recipe suggestions based on available inventory"""
    # Get all inventory items
    inventory_items = await db.inventory.find().to_list(1000)
    
    # Get expiring items (next 7 days)
    expiring_items = []
    for item in inventory_items:
        days_to_expire, _ = calculate_urgency(item.get('expiry_date'))
        if days_to_expire is not None and 0 <= days_to_expire <= 7:
            expiring_items.append(item['name'].lower())
    
    # All available items
    available_items = [item['name'].lower() for item in inventory_items]
    
    # Match recipes
    recipe_matches = []
    for recipe in RECIPE_DATABASE:
        recipe_ingredients = [ing.lower() for ing in recipe['ingredients']]
        
        # Calculate match score
        available = [ing for ing in recipe_ingredients if any(avail in ing or ing in avail for avail in available_items)]
        missing = [ing for ing in recipe_ingredients if ing not in available]
        expiring_used = [ing for ing in available if any(exp in ing or ing in exp for exp in expiring_items)]
        
        # Priority: uses expiring ingredients, fewer missing ingredients
        score = len(expiring_used) * 10 + len(available) - len(missing)
        
        recipe_matches.append({
            "recipe": recipe,
            "available": available,
            "missing": missing,
            "score": score,
            "waste_prevented": len(expiring_used)
        })
    
    # Sort by score
    recipe_matches.sort(key=lambda x: x['score'], reverse=True)
    
    # Format response
    results = []
    for match in recipe_matches[:max_results]:
        recipe = match['recipe']
        results.append(Recipe(
            name=recipe['name'],
            ingredients=recipe['ingredients'],
            available_ingredients=match['available'],
            missing_ingredients=match['missing'],
            steps=recipe['steps'],
            cooking_time=recipe['cooking_time'],
            difficulty=recipe['difficulty'],
            cuisine=recipe['cuisine'],
            meal_type=recipe['meal_type'],
            waste_prevented=match['waste_prevented']
        ))
    
    return results


# Dashboard Routes
@api_router.get("/dashboard/expiring-today")
async def get_expiring_today():
    """Get items expiring today"""
    items = await db.inventory.find().to_list(1000)
    
    expiring_today = []
    for item in items:
        days_to_expire, urgency = calculate_urgency(item.get('expiry_date'))
        if days_to_expire is not None and days_to_expire == 0:
            item['days_to_expire'] = days_to_expire
            item['urgency'] = urgency
            expiring_today.append(item)
    
    return expiring_today


@api_router.get("/dashboard/expiring-week")
async def get_expiring_week():
    """Get items expiring this week"""
    items = await db.inventory.find().to_list(1000)
    
    expiring_week = []
    for item in items:
        days_to_expire, urgency = calculate_urgency(item.get('expiry_date'))
        if days_to_expire is not None and 1 <= days_to_expire <= 7:
            item['days_to_expire'] = days_to_expire
            item['urgency'] = urgency
            expiring_week.append(item)
    
    return expiring_week


# Shopping List Routes
@api_router.get("/shopping", response_model=List[ShoppingListItem])
async def get_shopping_list():
    """Get shopping list"""
    items = await db.shopping_list.find().to_list(1000)
    return [ShoppingListItem(**item) for item in items]


@api_router.post("/shopping", response_model=ShoppingListItem)
async def add_shopping_item(item: ShoppingListItem):
    """Add item to shopping list"""
    item_dict = item.dict()
    item_dict['id'] = str(ObjectId())
    
    # Check for duplicates in inventory
    inventory_items = await db.inventory.find().to_list(1000)
    for inv_item in inventory_items:
        if inv_item['name'].lower() == item.name.lower():
            item_dict['is_duplicate'] = True
            item_dict['notes'] = f"You already have {inv_item.get('quantity', '')} {inv_item.get('unit', '')}"
            break
    
    await db.shopping_list.insert_one(item_dict)
    return ShoppingListItem(**item_dict)


@api_router.delete("/shopping/{item_id}")
async def delete_shopping_item(item_id: str):
    """Delete shopping list item"""
    result = await db.shopping_list.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
