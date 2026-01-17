import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LoadingScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
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
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2', '#f093fb']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Rotating outer circle with multiple colors */}
        <Animated.View
          style={[
            styles.outerCircle,
            {
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <View style={styles.outerCircleBorder} />
          <View style={[styles.colorDot, { top: 0, left: '50%', marginLeft: -8, backgroundColor: '#FF6B6B' }]} />
          <View style={[styles.colorDot, { bottom: 0, left: '50%', marginLeft: -8, backgroundColor: '#4ECDC4' }]} />
          <View style={[styles.colorDot, { top: '50%', marginTop: -8, left: 0, backgroundColor: '#FFE66D' }]} />
          <View style={[styles.colorDot, { top: '50%', marginTop: -8, right: 0, backgroundColor: '#95E1D3' }]} />
        </Animated.View>

        {/* Main icon container with gradient */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Ionicons name="leaf" size={60} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        {/* App name and tagline */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.appName}>Zero Waste</Text>
          <Text style={styles.tagline}>Food Planner</Text>
          
          {/* Colorful loading dots */}
          <View style={styles.dotsContainer}>
            <Animated.View
              style={[
                styles.dot,
                { backgroundColor: '#FF6B6B' },
                {
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [1, 1.2],
                        outputRange: [1, 1.5],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                { backgroundColor: '#4ECDC4' },
                {
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [1, 1.2],
                        outputRange: [1.2, 1.5],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                { backgroundColor: '#FFE66D' },
                {
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [1, 1.2],
                        outputRange: [1, 1.5],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </Animated.View>

        {/* Bottom message */}
        <Animated.View
          style={[
            styles.bottomMessage,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.messageText}>Reducing food waste, one meal at a time</Text>
        </Animated.View>
      </Animated.View>

      {/* Colorful decorative elements */}
      <Animated.View
        style={[
          styles.decorCircle1,
          {
            opacity: 0.15,
            backgroundColor: '#FFE66D',
            transform: [
              { rotate: spin },
              {
                scale: pulseAnim.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [1, 1.1],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.decorCircle2,
          {
            opacity: 0.15,
            backgroundColor: '#4ECDC4',
            transform: [
              {
                rotate: spin.interpolate({
                  inputRange: ['0deg', '360deg'],
                  outputRange: ['360deg', '0deg'],
                }),
              },
              {
                scale: pulseAnim.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [1, 1.1],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.decorCircle3,
          {
            opacity: 0.1,
            backgroundColor: '#FF6B6B',
          },
        ]}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerCircleBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderStyle: 'dashed',
  },
  colorDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  iconContainer: {
    marginBottom: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#FFF',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.95,
    marginBottom: 30,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  bottomMessage: {
    position: 'absolute',
    bottom: -120,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  messageText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    fontWeight: '500',
  },
  decorCircle1: {
    position: 'absolute',
    top: 80,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 120,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  decorCircle3: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 400,
    height: 400,
    borderRadius: 200,
    marginLeft: -200,
    marginTop: -200,
  },
});