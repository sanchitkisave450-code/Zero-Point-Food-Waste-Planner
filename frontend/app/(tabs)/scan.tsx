import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useInventory } from '../../contexts/InventoryContext';
import { BarCodeScanner } from 'expo-barcode-scanner';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ScanScreen() {
  const { addItem } = useInventory();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productData, setProductData] = useState<any>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanMode, setScanMode] = useState<'barcode' | 'expiry'>('barcode');

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: imageStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setHasPermission(cameraStatus === 'granted');
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    setScanning(false);
    await fetchProductByBarcode(data);
  };

  const fetchProductByBarcode = async (barcode: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/barcode/${barcode}`);
      
      if (response.data.found) {
        setProductData({
          barcode,
          ...response.data.product,
          quantity: '1',
          unit: 'pcs',
          category: 'Pantry',
          expiry_date: new Date().toISOString(),
        });
        setShowProductModal(true);
      } else {
        Alert.alert(
          'Product Not Found',
          'This product is not in our database. Would you like to add it manually?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add Manually',
              onPress: () => {
                setProductData({
                  barcode,
                  name: '',
                  brand: '',
                  quantity: '1',
                  unit: 'pcs',
                  category: 'Pantry',
                  expiry_date: new Date().toISOString(),
                });
                setShowProductModal(true);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Failed to fetch product information');
    } finally {
      setLoading(false);
    }
  };

  const handleManualBarcodeSubmit = () => {
    if (manualBarcode.length < 8) {
      Alert.alert('Invalid Barcode', 'Please enter a valid barcode');
      return;
    }
    fetchProductByBarcode(manualBarcode);
    setManualBarcode('');
  };

  const handleExpiryImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLoading(true);
        const response = await axios.post(`${BACKEND_URL}/api/ocr/expiry`, {
          image: result.assets[0].base64,
        });

        if (response.data.success) {
          Alert.alert(
            'Expiry Date Detected',
            `Found: ${new Date(response.data.expiry_date).toLocaleDateString()}\n\nConfidence: ${response.data.confidence}`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Use This Date',
                onPress: () => {
                  if (productData) {
                    setProductData({ ...productData, expiry_date: response.data.expiry_date });
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Could Not Detect Date',
            `Detected text: ${response.data.detected_text?.substring(0, 100) || 'No text found'}\n\nPlease enter the date manually.`
          );
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('OCR Error:', error);
      Alert.alert('Error', 'Failed to process image');
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!productData?.name) {
      Alert.alert('Error', 'Please enter a product name');
      return;
    }

    try {
      await addItem({
        name: productData.name,
        category: productData.category,
        quantity: productData.quantity,
        unit: productData.unit,
        expiry_date: productData.expiry_date,
        barcode: productData.barcode,
        brand: productData.brand,
      });
      
      setShowProductModal(false);
      setProductData(null);
      Alert.alert('Success', 'Product added to inventory!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add product');
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-off" size={60} color="#ccc" />
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermissions}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, scanMode === 'barcode' && styles.modeButtonActive]}
          onPress={() => setScanMode('barcode')}
        >
          <Ionicons name="barcode" size={24} color={scanMode === 'barcode' ? '#fff' : '#666'} />
          <Text style={[styles.modeText, scanMode === 'barcode' && styles.modeTextActive]}>
            Scan Barcode
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, scanMode === 'expiry' && styles.modeButtonActive]}
          onPress={() => setScanMode('expiry')}
        >
          <Ionicons name="calendar" size={24} color={scanMode === 'expiry' ? '#fff' : '#666'} />
          <Text style={[styles.modeText, scanMode === 'expiry' && styles.modeTextActive]}>
            Scan Expiry
          </Text>
        </TouchableOpacity>
      </View>

      {scanMode === 'barcode' ? (
        <>
          {/* Barcode Scanner */}
          {scanning ? (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            >
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanText}>Align barcode within frame</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setScanning(false);
                    setScanned(false);
                  }}
                >
                  <Ionicons name="close-circle" size={40} color="#fff" />
                </TouchableOpacity>
              </View>
            </CameraView>
          ) : (
            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
              <View style={styles.instructionCard}>
                <Ionicons name="qr-code-outline" size={60} color="#4CAF50" />
                <Text style={styles.instructionTitle}>Scan Product Barcode</Text>
                <Text style={styles.instructionText}>
                  Automatically fetch product details from our database
                </Text>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={() => setScanning(true)}>
                <Ionicons name="scan" size={24} color="#fff" />
                <Text style={styles.primaryButtonText}>Start Scanning</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.manualSection}>
                <Text style={styles.label}>Enter Barcode Manually</Text>
                <View style={styles.manualInputRow}>
                  <TextInput
                    style={styles.manualInput}
                    value={manualBarcode}
                    onChangeText={setManualBarcode}
                    placeholder="Enter barcode number"
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleManualBarcodeSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Ionicons name="search" size={24} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.instructionCard}>
            <Ionicons name="camera-outline" size={60} color="#4CAF50" />
            <Text style={styles.instructionTitle}>Scan Expiry Date</Text>
            <Text style={styles.instructionText}>
              Take a photo of the expiry date label, and we'll extract the date automatically
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleExpiryImagePick}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="image" size={24} color="#fff" />
                <Text style={styles.primaryButtonText}>Choose Image</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Product Modal */}
      <Modal visible={showProductModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              {productData?.image_url && (
                <Image
                  source={{ uri: productData.image_url }}
                  style={styles.productImage}
                  resizeMode="contain"
                />
              )}

              <Text style={styles.label}>Product Name *</Text>
              <TextInput
                style={styles.input}
                value={productData?.name || ''}
                onChangeText={text => setProductData({ ...productData, name: text })}
                placeholder="Enter product name"
              />

              <Text style={styles.label}>Brand</Text>
              <TextInput
                style={styles.input}
                value={productData?.brand || ''}
                onChangeText={text => setProductData({ ...productData, brand: text })}
                placeholder="Enter brand name"
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.pickerContainer}>
                {['Fridge', 'Pantry', 'Freezer', 'Leftovers'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.pickerOption,
                      productData?.category === cat && styles.pickerOptionActive,
                    ]}
                    onPress={() => setProductData({ ...productData, category: cat })}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        productData?.category === cat && styles.pickerOptionTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Quantity</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={productData?.quantity || ''}
                  onChangeText={text => setProductData({ ...productData, quantity: text })}
                  placeholder="1"
                  keyboardType="numeric"
                />
                <View style={styles.unitPicker}>
                  {['pcs', 'kg', 'L'].map(unit => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitOption,
                        productData?.unit === unit && styles.unitOptionActive,
                      ]}
                      onPress={() => setProductData({ ...productData, unit })}
                    >
                      <Text
                        style={[
                          styles.unitText,
                          productData?.unit === unit && styles.unitTextActive,
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.label}>Expiry Date</Text>
              <TouchableOpacity style={styles.expiryButton} onPress={handleExpiryImagePick}>
                <Ionicons name="camera" size={20} color="#4CAF50" />
                <Text style={styles.expiryButtonText}>Scan Expiry Date from Photo</Text>
              </TouchableOpacity>

              <Text style={styles.dateDisplay}>
                {productData?.expiry_date
                  ? new Date(productData.expiry_date).toLocaleDateString()
                  : 'No date set'}
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowProductModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={handleAddProduct}>
                <Text style={styles.addButtonText}>Add to Inventory</Text>
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
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modeSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#f5f5f5',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: '#4CAF50',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modeTextActive: {
    color: '#fff',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  scanOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#4CAF50',
    borderRadius: 12,
  },
  scanText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  content: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    padding: 24,
  },
  instructionCard: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    marginBottom: 24,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  manualSection: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    width: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  modalForm: {
    padding: 20,
  },
  productImage: {
    width: '100%',
    height: 150,
    marginBottom: 16,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
  expiryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  expiryButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  dateDisplay: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    padding: 8,
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