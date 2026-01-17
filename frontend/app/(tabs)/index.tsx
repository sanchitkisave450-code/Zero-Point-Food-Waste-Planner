import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInventory } from '../../contexts/InventoryContext';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { inventory, loading, refreshInventory } = useInventory();
  const router = useRouter();
  const [expiringToday, setExpiringToday] = useState<any[]>([]);
  const [expiringWeek, setExpiringWeek] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    loadDashboardData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
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
        return '#FF3B30';
      case 'warning':
        return '#FF9500';
      case 'safe':
        return '#34C759';
      default:
        return '#8E8E93';
    }
  };

  const renderInventoryItem = (item: any, index: number) => (
    <Animated.View
      key={item.id}
      style={[
        styles.itemCard,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateX: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.urgencyIndicator, { backgroundColor: getUrgencyColor(item.urgency) }]} />
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="cube-outline" size={12} color="#8E8E93" />
            <Text style={styles.metaText}>{item.quantity} {item.unit}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="location-outline" size={12} color="#8E8E93" />
            <Text style={styles.metaText}>{item.category}</Text>
          </View>
        </View>
        {item.days_to_expire !== null && (
          <View style={[styles.expiryBadge, { backgroundColor: getUrgencyColor(item.urgency) + '15' }]}>
            <Ionicons name="time-outline" size={14} color={getUrgencyColor(item.urgency)} />
            <Text style={[styles.expiryText, { color: getUrgencyColor(item.urgency) }]}>
              {item.days_to_expire === 0
                ? 'Expires today!'
                : item.days_to_expire < 0
                ? `Expired ${Math.abs(item.days_to_expire)}d ago`
                : `${item.days_to_expire}d left`}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </Animated.View>
  );

  const renderRecipeSuggestion = (recipe: any, index: number) => (
    <TouchableOpacity
      key={recipe.id}
      style={styles.recipeCard}
      activeOpacity={0.7}
      onPress={() => router.push('/recipes')}
    >
      <View style={styles.recipeIconContainer}>
        <Ionicons name="restaurant" size={24} color="#FFFFFF" />
      </View>
      <View style={styles.recipeContent}>
        <Text style={styles.recipeName} numberOfLines={1}>{recipe.name}</Text>
        <View style={styles.recipeStats}>
          <View style={styles.recipeStat}>
            <Ionicons name="time-outline" size={14} color="#8E8E93" />
            <Text style={styles.recipeStatText}>{recipe.cooking_time}min</Text>
          </View>
          <View style={styles.recipeStat}>
            <Ionicons name="checkmark-circle" size={14} color="#34C759" />
            <Text style={styles.recipeStatText}>{recipe.available_ingredients.length} available</Text>
          </View>
        </View>
        {recipe.waste_prevented > 0 && (
          <View style={styles.wastePreventBadge}>
            <Ionicons name="leaf" size={12} color="#34C759" />
            <Text style={styles.wastePreventText}>Prevents {recipe.waste_prevented} waste</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const totalItems = inventory.length;
  const urgentItems = expiringToday.length + expiringWeek.length;

  return (
    <View style={styles.container}>
      {/* Hero Header with Gradient */}
      <LinearGradient
        colors={['#34C759', '#30D158', '#32D74B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroHeader}
      >
        <View style={styles.heroContent}>
          <View>
            <Text style={styles.greeting}>Good day! 👋</Text>
            <Text style={styles.heroTitle}>Zero Waste Dashboard</Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalItems}</Text>
              <Text style={styles.statLabel}>Items</Text>
            </View>
            <View style={[styles.statBox, { marginLeft: 12 }]}>
              <Text style={[styles.statNumber, urgentItems > 0 && { color: '#FF3B30' }]}>{urgentItems}</Text>
              <Text style={styles.statLabel}>Urgent</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshInventory} tintColor="#34C759" />}
      >
        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#007AFF' }]}
              activeOpacity={0.8}
              onPress={() => router.push('/scan')}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="scan" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Scan</Text>
              <Text style={styles.actionSubtitle}>Barcode</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#5856D6' }]}
              activeOpacity={0.8}
              onPress={() => router.push('/inventory')}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="add-circle" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Add</Text>
              <Text style={styles.actionSubtitle}>Manual</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#FF9500' }]}
              activeOpacity={0.8}
              onPress={() => router.push('/recipes')}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="restaurant" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Cook</Text>
              <Text style={styles.actionSubtitle}>Recipes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#FF2D55' }]}
              activeOpacity={0.8}
              onPress={() => router.push('/shopping')}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="cart" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Shop</Text>
              <Text style={styles.actionSubtitle}>List</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Urgent Items */}
        {expiringToday.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.urgentBadge}>
                  <Ionicons name="warning" size={18} color="#FF3B30" />
                </View>
                <Text style={styles.sectionTitle}>Use Today</Text>
              </View>
              <Text style={styles.sectionCount}>{expiringToday.length}</Text>
            </View>
            <View style={styles.itemsContainer}>
              {expiringToday.map((item, index) => renderInventoryItem(item, index))}
            </View>
          </View>
        )}

        {/* This Week */}
        {expiringWeek.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={[styles.urgentBadge, { backgroundColor: '#FF950020' }]}>
                  <Ionicons name="time" size={18} color="#FF9500" />
                </View>
                <Text style={styles.sectionTitle}>This Week</Text>
              </View>
              <Text style={styles.sectionCount}>{expiringWeek.length}</Text>
            </View>
            <View style={styles.itemsContainer}>
              {expiringWeek.slice(0, 5).map((item, index) => renderInventoryItem(item, index))}
              {expiringWeek.length > 5 && (
                <TouchableOpacity
                  style={styles.viewMoreButton}
                  onPress={() => router.push('/inventory')}
                >
                  <Text style={styles.viewMoreText}>View all {expiringWeek.length} items</Text>
                  <Ionicons name="arrow-forward" size={16} color="#007AFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Recipe Suggestions */}
        {suggestions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={[styles.urgentBadge, { backgroundColor: '#34C75920' }]}>
                  <Ionicons name="bulb" size={18} color="#34C759" />
                </View>
                <Text style={styles.sectionTitle}>Smart Recipes</Text>
              </View>
            </View>
            <View style={styles.recipesContainer}>
              {suggestions.map((recipe, index) => renderRecipeSuggestion(recipe, index))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {inventory.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="cube-outline" size={80} color="#E5E5EA" />
            </View>
            <Text style={styles.emptyTitle}>Start Your Journey</Text>
            <Text style={styles.emptySubtitle}>
              Begin by scanning a product barcode{'
'}or adding items manually
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/scan')}
            >
              <Ionicons name="scan" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Scan First Item</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  heroHeader: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
  },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (width - 56) / 2,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionIconContainer: {
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urgentBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FF3B3020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  sectionCount: {
    fontSize: 17,
    fontWeight: '600',
    color: '#8E8E93',
  },
  itemsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  urgencyIndicator: {
    width: 4,
    height: 48,
    borderRadius: 2,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewMoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 6,
  },
  viewMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  recipesContainer: {
    gap: 12,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  recipeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipeContent: {
    flex: 1,
  },
  recipeName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  recipeStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  recipeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeStatText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  wastePreventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C75915',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  wastePreventText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});