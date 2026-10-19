/**
 * NativeWind only patches core react-native primitives (View, Text, Pressable, …)
 * automatically. Third-party components that need `className` support are
 * registered here, once, and this module is imported for its side effects
 * before anything renders (see app/_layout.tsx).
 */
import { Link } from 'expo-router';
import { cssInterop } from 'nativewind';

cssInterop(Link, { className: 'style' });
