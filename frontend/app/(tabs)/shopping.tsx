import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  priority: string;
  is_duplicate: boolean;
  notes?: string;
  checked: boolean;
}

export default function ShoppingScreen() {
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: '1',
    unit: 'pcs',
    priority: 'must-buy',
  });

  useEffect(() => {
    loadShoppingList();
  }, []);

  const loadShoppingList = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/shopping`);
      setShoppingList(response.data);
    } catch (error) {
      console.error('Error loading shopping list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name) {
      Alert.alert('Error', 'Please enter item name');
      return;
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/api/shopping`, {
        ...newItem,
        checked: false,
      });
      
      if (response.data.is_duplicate) {
        Alert.alert(
          'Duplicate Item',
          response.data.notes || 'This item already exists in your inventory',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add Anyway',
              onPress: () => {
                setShoppingList([...shoppingList, response.data]);
                setShowAddModal(false);
                resetForm();
              },
            },
          ]
        );
      } else {
        setShoppingList([...shoppingList, response.data]);
        setShowAddModal(false);
        resetForm();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    Alert.alert('Delete Item', `Remove ${name} from shopping list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${BACKEND_URL}/api/shopping/${id}`);
            setShoppingList(shoppingList.filter(item => item.id !== id));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const toggleCheck = (id: string) => {
    setShoppingList(
      shoppingList.map(item => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const resetForm = () => {
    setNewItem({
      name: '',
      quantity: '1',
      unit: 'pcs',
      priority: 'must-buy',
    });
  };

  const uncheckedItems = shoppingList.filter(item => !item.checked);
  const checkedItems = shoppingList.filter(item => item.checked);

  const renderShoppingItem = (item: ShoppingItem) => (
    <View key={item.id} style={styles.itemCard}>
      <TouchableOpacity onPress={() => toggleCheck(item.id)} style={styles.checkbox}>
        <Ionicons
          name={item.checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={item.checked ? '#4CAF50' : '#ccc'}
        />
      </TouchableOpacity>

      <View style={styles.itemContent}>
        <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
          {item.name}
        </Text>
        <Text style={styles.itemDetails}>
          {item.quantity} {item.unit}
        </Text>
        {item.is_duplicate && (
          <View style={styles.warningBadge}>
            <Ionicons name="warning" size={14} color="#ff9800" />
            <Text style={styles.warningText}>{item.notes || 'Already in inventory'}</Text>
          </View>
        )}
      </View>

      <View style={styles.itemActions}>
        {item.priority === 'must-buy' && (
          <View style={styles.priorityBadge}>
            <Text style={styles.priorityText}>Must</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => handleDeleteItem(item.id, item.name)}>
          <Ionicons name="trash-outline" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.header}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{uncheckedItems.length}</Text>
          <Text style={styles.statLabel}>To Buy</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{checkedItems.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {shoppingList.filter(item => item.is_duplicate).length}
          </Text>
          <Text style={styles.statLabel}>Duplicates</Text>
        </View>
      </View>

      {/* Shopping List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadShoppingList} />}
      >
        {uncheckedItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shopping List</Text>
            <View style={styles.itemsList}>
              {uncheckedItems.map(renderShoppingItem)}
            </View>
          </View>
        )}

        {checkedItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed ({checkedItems.length})</Text>
            <View style={styles.itemsList}>
              {checkedItems.map(renderShoppingItem)}
            </View>
          </View>
        )}

        {shoppingList.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={60} color="#ccc" />
            <Text style={styles.emptyTitle}>Shopping list is empty</Text>
            <Text style={styles.emptySubtitle}>
              Add items you need to buy or generate from recipes
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Shopping Item</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.label}>Item Name *</Text>
              <TextInput
                style={styles.input}
                value={newItem.name}
                onChangeText={text => setNewItem({ ...newItem, name: text })}
                placeholder="e.g., Tomatoes, Milk"
              />

              <Text style={styles.label}>Quantity</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  value={newItem.quantity}
                  onChangeText={text => setNewItem({ ...newItem, quantity: text })}
                  placeholder="1"
                  keyboardType="numeric"
                />
                <View style={styles.unitPicker}>
                  {['pcs', 'kg', 'g', 'L', 'ml'].map(unit => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitOption,
                        newItem.unit === unit && styles.unitOptionActive,
                      ]}
                      onPress={() => setNewItem({ ...newItem, unit })}
                    >
                      <Text
                        style={[
                          styles.unitText,
                          newItem.unit === unit && styles.unitTextActive,
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityPicker}>
                {[
                  { key: 'must-buy', label: 'Must Buy', color: '#f44336' },
                  { key: 'optional', label: 'Optional', color: '#ff9800' },
                ].map(priority => (
                  <TouchableOpacity
                    key={priority.key}
                    style={[
                      styles.priorityOption,
                      newItem.priority === priority.key && {
                        backgroundColor: priority.color,
                        borderColor: priority.color,
                      },
                    ]}
                    onPress={() => setNewItem({ ...newItem, priority: priority.key })}
                  >
                    <Text
                      style={[
                        styles.priorityOptionText,
                        newItem.priority === priority.key && styles.priorityOptionTextActive,
                      ]}
                    >
                      {priority.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
  },
  checkbox: {
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#ff9800',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priorityBadge: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f44336',
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalForm: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  inputHalf: {
    flex: 1,
  },
  unitPicker: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  unitOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  unitOptionActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  unitText: {
    fontSize: 12,
    color: '#666',
  },
  unitTextActive: {
    color: '#fff',
  },
  priorityPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  priorityOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  priorityOptionTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});