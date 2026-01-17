import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInventory } from '../contexts/InventoryContext';
import { useRouter } from 'expo-router';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function HomeScreen() {
  const { inventory, loading, refreshInventory } = useInventory();
  const router = useRouter();
  const [expiringToday, setExpiringToday] = useState<any[]>([]);
  const [expiringWeek, setExpiringWeek] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [inventory]);

  const loadDashboardData = async () => {
    try {
      const [todayRes, weekRes, recipesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/dashboard/expiring-today`),
        axios.get(`${BACKEND_URL}/api/dashboard/expiring-week`),
        axios.get(`${BACKEND_URL}/api/recipes/suggestions?max_results=3`),
      ]);
      
      setExpiringToday(todayRes.data);
      setExpiringWeek(weekRes.data);
      setSuggestions(recipesRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

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

  const renderInventoryItem = (item: any) => (
    <View key={item.id} style={styles.itemCard}>
      <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency) }]} />
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDetails}>
          {item.quantity} {item.unit} • {item.category}
        </Text>
        {item.days_to_expire !== null && (
          <Text style={styles.expiryText}>
            {item.days_to_expire === 0
              ? 'Expires today!'
              : item.days_to_expire < 0
              ? `Expired ${Math.abs(item.days_to_expire)} days ago`
              : `${item.days_to_expire} days left`}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </View>
  );

  const renderRecipeSuggestion = (recipe: any) => (
    <View key={recipe.id} style={styles.recipeCard}>
      <View style={styles.recipeHeader}>
        <Ionicons name="restaurant" size={24} color="#4CAF50" />
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName}>{recipe.name}</Text>
          <Text style={styles.recipeDetails}>
            {recipe.cooking_time} min • {recipe.difficulty}
          </Text>
        </View>
      </View>
      {recipe.waste_prevented > 0 && (
        <View style={styles.wasteBadge}>
          <Ionicons name="leaf" size={16} color="#4CAF50" />
          <Text style={styles.wasteText}>Prevents {recipe.waste_prevented} items from waste</Text>
        </View>
      )}
      <Text style={styles.ingredientsText}>
        ✓ {recipe.available_ingredients.length} available • ✗ {recipe.missing_ingredients.length} missing
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshInventory} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Zero-Point Dashboard</Text>
        <Text style={styles.subtitle}>Reducing food waste, one meal at a time</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/scan')}
        >
          <Ionicons name="qr-code" size={24} color="#fff" />
          <Text style={styles.actionText}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/inventory')}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.actionText}>Add Item</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/recipes')}
        >
          <Ionicons name="restaurant" size={24} color="#fff" />
          <Text style={styles.actionText}>Recipes</Text>
        </TouchableOpacity>
      </View>

      {/* Use Today Section */}
      {expiringToday.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={24} color="#f44336" />
            <Text style={styles.sectionTitle}>Use Today ({expiringToday.length})</Text>
          </View>
          <View style={styles.sectionContent}>
            {expiringToday.map(renderInventoryItem)}
          </View>
        </View>
      )}

      {/* Use This Week Section */}
      {expiringWeek.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={24} color="#ff9800" />
            <Text style={styles.sectionTitle}>Use This Week ({expiringWeek.length})</Text>
          </View>
          <View style={styles.sectionContent}>
            {expiringWeek.slice(0, 5).map(renderInventoryItem)}
            {expiringWeek.length > 5 && (
              <TouchableOpacity
                style={styles.viewMoreButton}
                onPress={() => router.push('/inventory')}
              >
                <Text style={styles.viewMoreText}>View all {expiringWeek.length} items</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Recipe Suggestions */}
      {suggestions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb" size={24} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Smart Suggestions</Text>
          </View>
          <View style={styles.sectionContent}>
            {suggestions.map(renderRecipeSuggestion)}
          </View>
          <TouchableOpacity
            style={styles.viewMoreButton}
            onPress={() => router.push('/recipes')}
          >
            <Text style={styles.viewMoreText}>View all recipes</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty State */}
      {inventory.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No items in inventory</Text>
          <Text style={styles.emptySubtitle}>Start by scanning a product or adding manually</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/scan')}
          >
            <Text style={styles.primaryButtonText}>Scan Your First Item</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  quickActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    margin: 16,
    marginTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  expiryText: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: '500',
  },
  recipeCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  recipeDetails: {
    fontSize: 12,
    color: '#666',
  },
  wasteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 4,
  },
  wasteText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  ingredientsText: {
    fontSize: 14,
    color: '#666',
  },
  viewMoreButton: {
    padding: 16,
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
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
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});