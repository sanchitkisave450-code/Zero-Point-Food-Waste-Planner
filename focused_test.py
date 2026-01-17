#!/usr/bin/env python3
"""
Focused Backend API Testing for specific issues
"""

import requests
import json
from datetime import datetime, timedelta

BACKEND_URL = "https://expiwise.preview.emergentagent.com/api"

def test_dashboard_endpoints():
    """Test dashboard endpoints specifically"""
    print("=== Testing Dashboard Endpoints ===")
    
    # First add some test data with specific expiry dates
    test_items = [
        {
            "name": "Expiring Today Item",
            "category": "Fridge",
            "quantity": "1",
            "unit": "piece",
            "expiry_date": datetime.now().isoformat()
        },
        {
            "name": "Expiring This Week Item", 
            "category": "Pantry",
            "quantity": "1",
            "unit": "piece",
            "expiry_date": (datetime.now() + timedelta(days=3)).isoformat()
        }
    ]
    
    created_ids = []
    
    # Create test items
    for item in test_items:
        try:
            response = requests.post(f"{BACKEND_URL}/inventory", json=item, timeout=10)
            if response.status_code == 200:
                data = response.json()
                created_ids.append(data['id'])
                print(f"✅ Created test item: {item['name']}")
            else:
                print(f"❌ Failed to create {item['name']}: {response.status_code}")
        except Exception as e:
            print(f"❌ Error creating {item['name']}: {e}")
    
    # Test dashboard endpoints
    try:
        response = requests.get(f"{BACKEND_URL}/dashboard/expiring-today", timeout=10)
        print(f"Dashboard expiring-today status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Expiring today: {len(data)} items")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Dashboard expiring-today error: {e}")
    
    try:
        response = requests.get(f"{BACKEND_URL}/dashboard/expiring-week", timeout=10)
        print(f"Dashboard expiring-week status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Expiring this week: {len(data)} items")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Dashboard expiring-week error: {e}")
    
    # Cleanup
    for item_id in created_ids:
        try:
            requests.delete(f"{BACKEND_URL}/inventory/{item_id}", timeout=5)
        except:
            pass

def test_shopping_duplicate_detection():
    """Test shopping list duplicate detection"""
    print("\n=== Testing Shopping List Duplicate Detection ===")
    
    # First check what's in inventory
    try:
        response = requests.get(f"{BACKEND_URL}/inventory", timeout=10)
        if response.status_code == 200:
            inventory = response.json()
            print(f"Current inventory has {len(inventory)} items:")
            for item in inventory:
                print(f"  - {item['name']}")
        else:
            print(f"❌ Failed to get inventory: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Error getting inventory: {e}")
        return
    
    # Test adding an item that matches inventory
    if inventory:
        existing_item = inventory[0]
        shopping_item = {
            "name": existing_item['name'],  # Exact match
            "quantity": "2",
            "unit": "pieces",
            "priority": "must-buy"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/shopping", json=shopping_item, timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"Added shopping item: {data['name']}")
                print(f"Is duplicate: {data.get('is_duplicate', False)}")
                print(f"Notes: {data.get('notes', 'None')}")
                
                if data.get('is_duplicate'):
                    print("✅ Duplicate detection working")
                else:
                    print("❌ Duplicate detection failed")
                
                # Cleanup
                try:
                    requests.delete(f"{BACKEND_URL}/shopping/{data['id']}", timeout=5)
                except:
                    pass
            else:
                print(f"❌ Failed to add shopping item: {response.status_code}")
        except Exception as e:
            print(f"❌ Error adding shopping item: {e}")

def test_barcode_invalid():
    """Test barcode API with truly invalid barcode"""
    print("\n=== Testing Barcode API with Invalid Barcode ===")
    
    invalid_barcodes = ["999999999999", "123456789012", "000000000000"]
    
    for barcode in invalid_barcodes:
        try:
            response = requests.get(f"{BACKEND_URL}/barcode/{barcode}", timeout=15)
            if response.status_code == 200:
                data = response.json()
                print(f"Barcode {barcode}: found={data.get('found')}")
                if data.get('found'):
                    print(f"  Product: {data.get('product', {}).get('name', 'Unknown')}")
            else:
                print(f"❌ Barcode {barcode} failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing barcode {barcode}: {e}")

if __name__ == "__main__":
    test_dashboard_endpoints()
    test_shopping_duplicate_detection()
    test_barcode_invalid()