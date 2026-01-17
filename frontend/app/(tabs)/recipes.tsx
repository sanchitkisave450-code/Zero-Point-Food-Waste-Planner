import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  available_ingredients: string[];
  missing_ingredients: string[];
  steps: string[];
  cooking_time: number;
  difficulty: string;
  cuisine: string;
  meal_type: string;
  waste_prevented: number;
}

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/recipes/suggestions?max_results=10`);
      setRecipes(response.data);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    if (filter === 'all') return true;
    return recipe.meal_type === filter;
  });

  const renderRecipeCard = (recipe: Recipe) => (
    <TouchableOpacity
      key={recipe.id}
      style={styles.recipeCard}
      onPress={() => {
        setSelectedRecipe(recipe);
        setShowRecipeModal(true);
      }}
    >
      <View style={styles.recipeHeader}>
        <View style={styles.recipeIcon}>
          <Ionicons name="restaurant" size={24} color="#4CAF50" />
        </View>
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName}>{recipe.name}</Text>
          <Text style={styles.recipeDetails}>
            {recipe.cooking_time} min • {recipe.difficulty} • {recipe.meal_type}
          </Text>
        </View>
        {recipe.waste_prevented > 0 && (
          <View style={styles.wasteBadge}>
            <Ionicons name="leaf" size={16} color="#4CAF50" />
            <Text style={styles.wasteBadgeText}>{recipe.waste_prevented}</Text>
          </View>
        )}
      </View>

      <View style={styles.ingredientsSection}>
        <View style={styles.ingredientsStat}>
          <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
          <Text style={styles.availableText}>
            {recipe.available_ingredients.length} available
          </Text>
        </View>
        <View style={styles.ingredientsStat}>
          <Ionicons name="close-circle" size={18} color="#f44336" />
          <Text style={styles.missingText}>
            {recipe.missing_ingredients.length} missing
          </Text>
        </View>
      </View>

      <View style={styles.recipeFooter}>
        <View style={styles.cuisineBadge}>
          <Text style={styles.cuisineText}>{recipe.cuisine}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {[
          { key: 'all', label: 'All', icon: 'apps' },
          { key: 'breakfast', label: 'Breakfast', icon: 'sunny' },
          { key: 'lunch', label: 'Lunch', icon: 'pizza' },
          { key: 'dinner', label: 'Dinner', icon: 'moon' },
        ].map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.filterTab, filter === item.key && styles.filterTabActive]}
            onPress={() => setFilter(item.key)}
          >
            <Ionicons
              name={item.icon as any}
              size={20}
              color={filter === item.key ? '#fff' : '#666'}
            />
            <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recipes List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRecipes} />}
      >
        {filteredRecipes.length > 0 ? (
          <View style={styles.recipesList}>
            {filteredRecipes.map(renderRecipeCard)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={60} color="#ccc" />
            <Text style={styles.emptyTitle}>No recipes found</Text>
            <Text style={styles.emptySubtitle}>
              Add more items to your inventory to get personalized recipe suggestions
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Recipe Detail Modal */}
      <Modal
        visible={showRecipeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRecipeModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedRecipe?.name}</Text>
              <TouchableOpacity onPress={() => setShowRecipeModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Recipe Info */}
              <View style={styles.recipeMetaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time" size={20} color="#666" />
                  <Text style={styles.metaText}>{selectedRecipe?.cooking_time} min</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="speedometer" size={20} color="#666" />
                  <Text style={styles.metaText}>{selectedRecipe?.difficulty}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="location" size={20} color="#666" />
                  <Text style={styles.metaText}>{selectedRecipe?.cuisine}</Text>
                </View>
              </View>

              {selectedRecipe?.waste_prevented && selectedRecipe.waste_prevented > 0 && (
                <View style={styles.impactCard}>
                  <Ionicons name="leaf" size={24} color="#4CAF50" />
                  <Text style={styles.impactText}>
                    This recipe will help prevent {selectedRecipe.waste_prevented} items from going to waste!
                  </Text>
                </View>
              )}

              {/* Ingredients */}
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <View style={styles.ingredientsContainer}>
                {selectedRecipe?.available_ingredients.map((ingredient, index) => (
                  <View key={`avail-${index}`} style={styles.ingredientItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.ingredientTextAvailable}>{ingredient}</Text>
                  </View>
                ))}
                {selectedRecipe?.missing_ingredients.map((ingredient, index) => (
                  <View key={`miss-${index}`} style={styles.ingredientItem}>
                    <Ionicons name="close-circle" size={20} color="#f44336" />
                    <Text style={styles.ingredientTextMissing}>{ingredient}</Text>
                  </View>
                ))}
              </View>

              {/* Steps */}
              <Text style={styles.sectionTitle}>Cooking Steps</Text>
              {selectedRecipe?.steps.map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </ScrollView>

            {selectedRecipe?.missing_ingredients && selectedRecipe.missing_ingredients.length > 0 && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.addToShoppingButton}
                  onPress={() => {
                    // TODO: Add missing ingredients to shopping list
                    setShowRecipeModal(false);
                  }}
                >
                  <Ionicons name="cart" size={20} color="#fff" />
                  <Text style={styles.addToShoppingText}>Add Missing Items to Shopping</Text>
                </TouchableOpacity>
              </View>
            )}
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
  filterScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#4CAF50',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  recipesList: {
    padding: 16,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  recipeDetails: {
    fontSize: 12,
    color: '#666',
  },
  wasteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  wasteBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  ingredientsSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  ingredientsStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availableText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  missingText: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: '500',
  },
  recipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cuisineBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cuisineText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
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
    lineHeight: 20,
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
    maxHeight: '90%',
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
    flex: 1,
  },
  modalBody: {
    padding: 20,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
  },
  impactCard: {
    flexDirection: 'row',
    backgroundColor: '#e8f5e9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
    alignItems: 'center',
  },
  impactText: {
    flex: 1,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  ingredientsContainer: {
    marginBottom: 24,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  ingredientTextAvailable: {
    fontSize: 14,
    color: '#333',
  },
  ingredientTextMissing: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  addToShoppingButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addToShoppingText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});