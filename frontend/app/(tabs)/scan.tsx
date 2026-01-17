import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useInventory } from '../../contexts/InventoryContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ScanScreen() {
  const { addItem } = useInventory();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productData, setProductData] = useState<any>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanMode, setScanMode] = useState<'barcode' | 'expiry'>('barcode');
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    // Pulse animation for scan frame
    if (scanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [scanning]);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: imageStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setHasPermission(cameraStatus === 'granted');
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    // Prevent duplicate scans
    if (data === lastScannedCode) {
      return;
    }

    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setLastScannedCode(data);
    setScanning(false);

    // Quick feedback
    await fetchProductByBarcode(data);

    // Reset after 2 seconds to allow rescanning
    scanTimeoutRef.current = setTimeout(() => {
      setLastScannedCode('');
    }, 2000);
  };

  const fetchProductByBarcode = async (barcode: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/barcode/${barcode}`, {
        timeout: 5000, // 5 second timeout
      });
      
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
          'Would you like to add it manually?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setScanning(true) },
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
      Alert.alert('Error', 'Failed to fetch product. Try again?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => setScanning(true) },
      ]);
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
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLoading(true);
        const response = await axios.post(
          `${BACKEND_URL}/api/ocr/expiry`,
          { image: result.assets[0].base64 },
          { timeout: 10000 }
        );

        if (response.data.success) {
          Alert.alert(
            'Expiry Date Detected',
            `Found: ${new Date(response.data.expiry_date).toLocaleDateString()}`,
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
            'Please enter the date manually.'
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
      setLoading(true);
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
      setLoading(false);
      Alert.alert('Success', 'Product added to inventory!', [
        {
          text: 'Scan Another',
          onPress: () => {
            setLastScannedCode('');
            setScanning(true);
          },
        },
        { text: 'Done' },
      ]);
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to add product');
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-off" size={60} color="#C7C7CC" />
        <Text style={styles.permissionText}>Camera permission required</Text>
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
          <Ionicons name="barcode" size={24} color={scanMode === 'barcode' ? '#FFF' : '#8E8E93'} />
          <Text style={[styles.modeText, scanMode === 'barcode' && styles.modeTextActive]}>
            Barcode
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, scanMode === 'expiry' && styles.modeButtonActive]}
          onPress={() => setScanMode('expiry')}
        >
          <Ionicons name="calendar" size={24} color={scanMode === 'expiry' ? '#FFF' : '#8E8E93'} />
          <Text style={[styles.modeText, scanMode === 'expiry' && styles.modeTextActive]}>
            Expiry
          </Text>
        </TouchableOpacity>
      </View>

      {scanMode === 'barcode' ? (
        <>
          {scanning ? (
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'],
                }}
                onBarcodeScanned={handleBarcodeScanned}
              >
                <View style={styles.scanOverlay}>
                  <View style={styles.scanHeader}>
                    <Text style={styles.scanTitle}>Scan Barcode</Text>
                    <Text style={styles.scanSubtitle}>Align barcode in the frame</Text>
                  </View>

                  <Animated.View
                    style={[
                      styles.scanFrame,
                      {
                        transform: [{ scale: pulseAnim }],
                      },
                    ]}
                  >
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                  </Animated.View>

                  <View style={styles.scanActions}>
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => {
                        setScanning(false);
                        setLastScannedCode('');
                      }}
                    >
                      <Ionicons name="close-circle" size={48} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </CameraView>

              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#FFF" />
                  <Text style={styles.loadingText}>Fetching product...</Text>
                </View>
              )}
            </View>
          ) : (
            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
              <View style={styles.instructionCard}>
                <View style={styles.iconCircle}>
                  <Ionicons name="scan" size={40} color="#007AFF" />
                </View>
                <Text style={styles.instructionTitle}>Fast Barcode Scan</Text>
                <Text style={styles.instructionText}>
                  Point camera at barcode{'\n'}Auto-detect in 0.5 seconds
                </Text>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setLastScannedCode('');
                  setScanning(true);
                }}
              >
                <Ionicons name="scan" size={24} color="#FFF" />
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
                    placeholder="123456789012"
                    keyboardType="numeric"
                    placeholderTextColor="#C7C7CC"
                  />
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleManualBarcodeSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Ionicons name="search" size={24} color="#FFF" />
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
            <View style={styles.iconCircle}>
              <Ionicons name="camera" size={40} color="#FF9500" />
            </View>
            <Text style={styles.instructionTitle}>Scan Expiry Date</Text>
            <Text style={styles.instructionText}>
              Take a photo of expiry label{'\n'}AI will extract the date
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#FF9500' }]}
            onPress={handleExpiryImagePick}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="image" size={24} color="#FFF" />
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
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              {productData?.image_url && (
                <Image
                  source={{ uri: productData.image_url }}
                  style={styles.productImage}
                />
              )}

              <Text style={styles.label}>Product Name *</Text>
              <TextInput
                style={styles.input}
                value={productData?.name || ''}
                onChangeText={text => setProductData({ ...productData, name: text })}
                placeholder="Enter product name"
                placeholderTextColor="#C7C7CC"
              />

              <Text style={styles.label}>Brand</Text>
              <TextInput
                style={styles.input}
                value={productData?.brand || ''}
                onChangeText={text => setProductData({ ...productData, brand: text })}
                placeholder="Enter brand"
                placeholderTextColor="#C7C7CC"
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
                  placeholderTextColor="#C7C7CC"
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
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowProductModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, loading && { opacity: 0.6 }]}
                onPress={handleAddProduct}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.addButtonText}>Add to Inventory</Text>
                )}
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
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  modeSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFF',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: '#007AFF',
  },
  modeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
  modeTextActive: {
    color: '#FFF',
  },
  cameraContainer: {
    flex: 1,
    width: '100%',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  scanHeader: {
    alignItems: 'center',
  },
  scanTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  scanSubtitle: {
    fontSize: 15,
    color: '#FFF',
    opacity: 0.8,
  },
  scanFrame: {
    width: 280,
    height: 280,
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 20,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFF',
  },
  topLeft: {
    top: -3,
    left: -3,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: -3,
    right: -3,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 20,
  },
  scanActions: {
    alignItems: 'center',
  },
  closeButton: {
    padding: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 17,
    marginTop: 16,
  },
  content: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    padding: 20,
  },
  instructionCard: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  instructionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  manualSection: {
    marginTop: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    backgroundColor: '#FFF',
    color: '#000',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    width: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  modalForm: {
    padding: 20,
  },
  productImage: {
    width: '100%',
    height: 150,
    marginBottom: 20,
    borderRadius: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    marginBottom: 16,
    backgroundColor: '#FFF',
    color: '#000',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFF',
  },
  pickerOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pickerOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  pickerOptionTextActive: {
    color: '#FFF',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  unitOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  unitText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  unitTextActive: {
    color: '#FFF',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 17,
    color: '#000',
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 17,
    color: '#FFF',
    fontWeight: '600',
  },
});
