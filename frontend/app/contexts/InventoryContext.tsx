import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  expiry_date?: string;
  barcode?: string;
  image?: string;
  brand?: string;
  days_to_expire?: number;
  urgency?: string;
}

interface InventoryContextType {
  inventory: InventoryItem[];
  loading: boolean;
  refreshInventory: () => Promise<void>;
  addItem: (item: any) => Promise<void>;
  updateItem: (id: string, updates: any) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshInventory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/inventory`);
      setInventory(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (item: any) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/inventory`, item);
      setInventory([...inventory, response.data]);
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  };

  const updateItem = async (id: string, updates: any) => {
    try {
      const response = await axios.put(`${BACKEND_URL}/api/inventory/${id}`, updates);
      setInventory(inventory.map(item => item.id === id ? response.data : item));
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/inventory/${id}`);
      setInventory(inventory.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshInventory();
  }, []);

  return (
    <InventoryContext.Provider value={{ inventory, loading, refreshInventory, addItem, updateItem, deleteItem }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
};