#!/usr/bin/env python3
"""
Backend API Testing for Food Waste Zero-Point Planner
Tests all backend endpoints comprehensively
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import time
import sys

# Backend URL from environment
BACKEND_URL = "https://expiwise.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.test_results = []
        self.created_items = []  # Track created items for cleanup
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_api_health(self):
        """Test basic API connectivity"""
        try:
            response = requests.get(f"{BACKEND_URL}/", timeout=10)
            if response.status_code == 200:
                self.log_result("API Health Check", True, "API is accessible")
                return True
            else:
                self.log_result("API Health Check", False, f"API returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("API Health Check", False, f"Cannot connect to API: {str(e)}")
            return False
    
    def test_inventory_crud(self):
        """Test all inventory CRUD operations"""
        print("\n=== Testing Inventory CRUD Operations ===")
        
        # Test data with various categories and expiry dates
        test_items = [
            {
                "name": "Fresh Milk",
                "category": "Fridge",
                "quantity": "1",
                "unit": "liter",
                "expiry_date": (datetime.now() + timedelta(days=2)).isoformat(),
                "brand": "Amul"
            },
            {
                "name": "Basmati Rice",
                "category": "Pantry", 
                "quantity": "5",
                "unit": "kg",
                "expiry_date": (datetime.now() + timedelta(days=365)).isoformat(),
                "brand": "India Gate"
            },
            {
                "name": "Frozen Peas",
                "category": "Freezer",
                "quantity": "500",
                "unit": "grams",
                "expiry_date": (datetime.now() + timedelta(days=90)).isoformat()
            },
            {
                "name": "Leftover Dal",
                "category": "Leftovers",
                "quantity": "2",
                "unit": "bowls",
                "expiry_date": (datetime.now() + timedelta(days=1)).isoformat()
            },
            {
                "name": "Expired Bread",
                "category": "Pantry",
                "quantity": "1",
                "unit": "loaf",
                "expiry_date": (datetime.now() - timedelta(days=2)).isoformat()
            }
        ]
        
        created_ids = []
        
        # Test CREATE
        for item in test_items:
            try:
                response = requests.post(f"{BACKEND_URL}/inventory", json=item, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    created_ids.append(data['id'])
                    self.created_items.append(data['id'])
                    
                    # Verify urgency calculation
                    expected_urgency = self._calculate_expected_urgency(item['expiry_date'])
                    if data.get('urgency') == expected_urgency:
                        self.log_result(f"Create Inventory Item - {item['name']}", True, 
                                      f"Created with correct urgency: {data.get('urgency')}")
                    else:
                        self.log_result(f"Create Inventory Item - {item['name']}", False, 
                                      f"Wrong urgency. Expected: {expected_urgency}, Got: {data.get('urgency')}")
                else:
                    self.log_result(f"Create Inventory Item - {item['name']}", False, 
                                  f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result(f"Create Inventory Item - {item['name']}", False, str(e))
        
        # Test GET ALL
        try:
            response = requests.get(f"{BACKEND_URL}/inventory", timeout=10)
            if response.status_code == 200:
                items = response.json()
                if len(items) >= len(created_ids):
                    self.log_result("Get All Inventory", True, f"Retrieved {len(items)} items")
                    
                    # Test category filtering
                    for category in ["Fridge", "Pantry", "Freezer", "Leftovers"]:
                        cat_response = requests.get(f"{BACKEND_URL}/inventory?category={category}", timeout=10)
                        if cat_response.status_code == 200:
                            cat_items = cat_response.json()
                            filtered_correctly = all(item['category'] == category for item in cat_items)
                            self.log_result(f"Filter by Category - {category}", filtered_correctly, 
                                          f"Found {len(cat_items)} items in {category}")
                        else:
                            self.log_result(f"Filter by Category - {category}", False, 
                                          f"Status: {cat_response.status_code}")
                else:
                    self.log_result("Get All Inventory", False, f"Expected at least {len(created_ids)} items, got {len(items)}")
            else:
                self.log_result("Get All Inventory", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Get All Inventory", False, str(e))
        
        # Test GET SINGLE
        if created_ids:
            try:
                item_id = created_ids[0]
                response = requests.get(f"{BACKEND_URL}/inventory/{item_id}", timeout=10)
                if response.status_code == 200:
                    item = response.json()
                    self.log_result("Get Single Inventory Item", True, f"Retrieved item: {item.get('name')}")
                else:
                    self.log_result("Get Single Inventory Item", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Get Single Inventory Item", False, str(e))
        
        # Test UPDATE
        if created_ids:
            try:
                item_id = created_ids[0]
                update_data = {
                    "name": "Updated Fresh Milk",
                    "quantity": "2",
                    "expiry_date": (datetime.now() + timedelta(days=3)).isoformat()
                }
                response = requests.put(f"{BACKEND_URL}/inventory/{item_id}", json=update_data, timeout=10)
                if response.status_code == 200:
                    updated_item = response.json()
                    if updated_item.get('name') == "Updated Fresh Milk":
                        self.log_result("Update Inventory Item", True, "Item updated successfully")
                    else:
                        self.log_result("Update Inventory Item", False, "Update data not reflected")
                else:
                    self.log_result("Update Inventory Item", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Update Inventory Item", False, str(e))
        
        # Test DELETE (delete one item, keep others for recipe testing)
        if created_ids:
            try:
                item_id = created_ids[-1]  # Delete the last item
                response = requests.delete(f"{BACKEND_URL}/inventory/{item_id}", timeout=10)
                if response.status_code == 200:
                    self.log_result("Delete Inventory Item", True, "Item deleted successfully")
                    self.created_items.remove(item_id)
                else:
                    self.log_result("Delete Inventory Item", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Delete Inventory Item", False, str(e))
    
    def _calculate_expected_urgency(self, expiry_date_str):
        """Calculate expected urgency for validation"""
        try:
            expiry = datetime.fromisoformat(expiry_date_str.replace('Z', '+00:00'))
            today = datetime.now()
            days_diff = (expiry - today).days
            
            if days_diff < 0:
                return "expired"
            elif days_diff == 0:
                return "critical"
            elif days_diff <= 3:
                return "critical"
            elif days_diff <= 7:
                return "warning"
            else:
                return "safe"
        except:
            return "unknown"
    
    def test_barcode_api(self):
        """Test barcode API with valid and invalid barcodes"""
        print("\n=== Testing Barcode API ===")
        
        # Test valid barcode
        try:
            valid_barcode = "737628064502"
            response = requests.get(f"{BACKEND_URL}/barcode/{valid_barcode}", timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data.get('found') == True and data.get('product'):
                    self.log_result("Barcode API - Valid Barcode", True, 
                                  f"Found product: {data['product'].get('name', 'Unknown')}")
                else:
                    self.log_result("Barcode API - Valid Barcode", False, 
                                  f"Expected found=True with product data, got: {data}")
            else:
                self.log_result("Barcode API - Valid Barcode", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Barcode API - Valid Barcode", False, str(e))
        
        # Test invalid barcode
        try:
            invalid_barcode = "999999999999"
            response = requests.get(f"{BACKEND_URL}/barcode/{invalid_barcode}", timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data.get('found') == False:
                    self.log_result("Barcode API - Invalid Barcode", True, "Correctly returned found=False")
                else:
                    self.log_result("Barcode API - Invalid Barcode", False, 
                                  f"Expected found=False, got: {data}")
            else:
                self.log_result("Barcode API - Invalid Barcode", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Barcode API - Invalid Barcode", False, str(e))
    
    def test_ocr_api(self):
        """Test OCR API - Note: Skipping actual image test due to complexity"""
        print("\n=== Testing OCR API ===")
        
        # Create a simple test image (1x1 white pixel) as base64
        try:
            # Simple base64 encoded 1x1 white PNG
            test_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
            
            payload = {"image": test_image_b64}
            response = requests.post(f"{BACKEND_URL}/ocr/expiry", json=payload, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                # OCR should process but likely not find a date in a 1x1 pixel
                if 'success' in data and 'confidence' in data:
                    self.log_result("OCR API - Basic Functionality", True, 
                                  f"OCR processed image, success: {data.get('success')}")
                else:
                    self.log_result("OCR API - Basic Functionality", False, 
                                  f"Missing expected fields in response: {data}")
            else:
                self.log_result("OCR API - Basic Functionality", False, 
                              f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("OCR API - Basic Functionality", False, str(e))
    
    def test_recipe_suggestions(self):
        """Test recipe suggestions API"""
        print("\n=== Testing Recipe Suggestions ===")
        
        try:
            response = requests.get(f"{BACKEND_URL}/recipes/suggestions?max_results=5", timeout=10)
            if response.status_code == 200:
                recipes = response.json()
                if isinstance(recipes, list):
                    self.log_result("Recipe Suggestions API", True, 
                                  f"Retrieved {len(recipes)} recipe suggestions")
                    
                    # Verify recipe structure
                    if recipes:
                        recipe = recipes[0]
                        required_fields = ['name', 'ingredients', 'available_ingredients', 
                                         'missing_ingredients', 'steps', 'cooking_time', 'waste_prevented']
                        missing_fields = [field for field in required_fields if field not in recipe]
                        
                        if not missing_fields:
                            self.log_result("Recipe Structure Validation", True, 
                                          f"Recipe has all required fields")
                        else:
                            self.log_result("Recipe Structure Validation", False, 
                                          f"Missing fields: {missing_fields}")
                else:
                    self.log_result("Recipe Suggestions API", False, 
                                  f"Expected list, got: {type(recipes)}")
            else:
                self.log_result("Recipe Suggestions API", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Recipe Suggestions API", False, str(e))
    
    def test_dashboard_endpoints(self):
        """Test dashboard endpoints"""
        print("\n=== Testing Dashboard Endpoints ===")
        
        # Test expiring today
        try:
            response = requests.get(f"{BACKEND_URL}/dashboard/expiring-today", timeout=10)
            if response.status_code == 200:
                items = response.json()
                if isinstance(items, list):
                    self.log_result("Dashboard - Expiring Today", True, 
                                  f"Retrieved {len(items)} items expiring today")
                else:
                    self.log_result("Dashboard - Expiring Today", False, 
                                  f"Expected list, got: {type(items)}")
            else:
                self.log_result("Dashboard - Expiring Today", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Dashboard - Expiring Today", False, str(e))
        
        # Test expiring this week
        try:
            response = requests.get(f"{BACKEND_URL}/dashboard/expiring-week", timeout=10)
            if response.status_code == 200:
                items = response.json()
                if isinstance(items, list):
                    self.log_result("Dashboard - Expiring Week", True, 
                                  f"Retrieved {len(items)} items expiring this week")
                else:
                    self.log_result("Dashboard - Expiring Week", False, 
                                  f"Expected list, got: {type(items)}")
            else:
                self.log_result("Dashboard - Expiring Week", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Dashboard - Expiring Week", False, str(e))
    
    def test_shopping_list_api(self):
        """Test shopping list API with duplicate detection"""
        print("\n=== Testing Shopping List API ===")
        
        # Test GET empty list first
        try:
            response = requests.get(f"{BACKEND_URL}/shopping", timeout=10)
            if response.status_code == 200:
                items = response.json()
                self.log_result("Get Shopping List", True, f"Retrieved {len(items)} shopping items")
            else:
                self.log_result("Get Shopping List", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Get Shopping List", False, str(e))
        
        # Test ADD shopping items
        shopping_items = [
            {
                "name": "Organic Tomatoes",
                "quantity": "1",
                "unit": "kg",
                "priority": "must-buy"
            },
            {
                "name": "Fresh Milk",  # This should be detected as duplicate if inventory has milk
                "quantity": "2",
                "unit": "liters", 
                "priority": "optional"
            }
        ]
        
        created_shopping_ids = []
        
        for item in shopping_items:
            try:
                response = requests.post(f"{BACKEND_URL}/shopping", json=item, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    created_shopping_ids.append(data['id'])
                    
                    # Check duplicate detection for milk
                    if item['name'] == "Fresh Milk":
                        if data.get('is_duplicate'):
                            self.log_result("Shopping List - Duplicate Detection", True, 
                                          f"Correctly detected duplicate: {data.get('notes', '')}")
                        else:
                            self.log_result("Shopping List - Duplicate Detection", False, 
                                          "Failed to detect duplicate item in inventory")
                    else:
                        self.log_result(f"Add Shopping Item - {item['name']}", True, "Item added successfully")
                else:
                    self.log_result(f"Add Shopping Item - {item['name']}", False, 
                                  f"Status: {response.status_code}")
            except Exception as e:
                self.log_result(f"Add Shopping Item - {item['name']}", False, str(e))
        
        # Test DELETE shopping item
        if created_shopping_ids:
            try:
                item_id = created_shopping_ids[0]
                response = requests.delete(f"{BACKEND_URL}/shopping/{item_id}", timeout=10)
                if response.status_code == 200:
                    self.log_result("Delete Shopping Item", True, "Item deleted successfully")
                else:
                    self.log_result("Delete Shopping Item", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Delete Shopping Item", False, str(e))
    
    def cleanup(self):
        """Clean up created test data"""
        print("\n=== Cleaning Up Test Data ===")
        for item_id in self.created_items:
            try:
                requests.delete(f"{BACKEND_URL}/inventory/{item_id}", timeout=5)
            except:
                pass  # Ignore cleanup errors
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🧪 Starting Food Waste Zero-Point Planner Backend API Tests")
        print(f"🔗 Testing against: {BACKEND_URL}")
        print("=" * 60)
        
        # Check API health first
        if not self.test_api_health():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Run all tests
        self.test_inventory_crud()
        self.test_barcode_api()
        self.test_ocr_api()
        self.test_recipe_suggestions()
        self.test_dashboard_endpoints()
        self.test_shopping_list_api()
        
        # Cleanup
        self.cleanup()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)