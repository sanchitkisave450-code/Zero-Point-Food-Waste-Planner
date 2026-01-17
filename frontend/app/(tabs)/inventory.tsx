import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInventory } from '../../contexts/InventoryContext';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function InventoryScreen() {
  const { inventory, loading, refreshInventory, addItem, updateItem, deleteItem } = useInventory();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Fridge',
    quantity: '',
    unit: 'pcs',
    expiry_date: new Date().toISOString(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const categories = ['All', 'Fridge', 'Pantry', 'Freezer', 'Leftovers'];

  const filteredInventory = selectedCategory === 'All'
    ? inventory
    : inventory.filter(item => item.category === selectedCategory);

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'critical':
      case 'expired':
        return '#f44336';
      case 'warning':
        return '#ff9800';
      case 'safe':
        return '#4CAF50';
      default:
        return '#999';
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.quantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await addItem(newItem);
      setShowAddModal(false);
      setNewItem({
        name: '',
        category: 'Fridge',
        quantity: '',
        unit: 'pcs',
        expiry_date: new Date().toISOString(),
      });
      Alert.alert('Success', 'Item added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const handleDeleteItem = (id: string, name: string) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const renderInventoryItem = (item: any) => (
    <View key={item.id} style={styles.itemCard}>
      <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency) }]} />
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDetails}>
          {item.quantity} {item.unit} • {item.category}
        </Text>
        {item.brand && <Text style={styles.brandText}>{item.brand}</Text>}
        {item.days_to_expire !== null && (
          <Text style={[styles.expiryText, { color: getUrgencyColor(item.urgency) }]}>
            {item.days_to_expire === 0
              ? 'Expires today!'
              : item.days_to_expire < 0
              ? `Expired ${Math.abs(item.days_to_expire)} days ago`
              : `${item.days_to_expire} days left`}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteItem(item.id, item.name)}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={20} color="#f44336" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryTab,
              selectedCategory === category && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Inventory List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshInventory} />}
      >
        {filteredInventory.length > 0 ? (
          <View style={styles.itemsList}>
            {filteredInventory.map(renderInventoryItem)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No items in {selectedCategory.toLowerCase()}</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
      >
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
              <Text style={styles.modalTitle}>Add New Item</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.label}>Item Name *</Text>
              <TextInput
                style={styles.input}
                value={newItem.name}
                onChangeText={text => setNewItem({ ...newItem, name: text })}
                placeholder="e.g., Milk, Tomatoes"
              />

              <Text style={styles.label}>Category *</Text>
              <View style={styles.pickerContainer}>
                {['Fridge', 'Pantry', 'Freezer', 'Leftovers'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.pickerOption,
                      newItem.category === cat && styles.pickerOptionActive,
                    ]}
                    onPress={() => setNewItem({ ...newItem, category: cat })}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        newItem.category === cat && styles.pickerOptionTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Quantity *</Text>
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

              <Text style={styles.label}>Expiry Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color="#4CAF50" />
                <Text style={styles.dateText}>
                  {new Date(newItem.expiry_date).toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={new Date(newItem.expiry_date)}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) {
                      setNewItem({ ...newItem, expiry_date: date.toISOString() });
                    }
                  }}
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddItem}
              >
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
  categoryScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  categoryTabActive: {
    backgroundColor: '#4CAF50',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  itemsList: {
    padding: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  urgencyBadge: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  brandText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
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
    maxHeight: '80%',
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
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  pickerOptionActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#666',
  },
  pickerOptionTextActive: {
    color: '#fff',
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
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