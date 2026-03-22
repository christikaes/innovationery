import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDXPJ9ZMz9y28yqXDbW1t2FWH9s2Wjtpy8',
  authDomain: 'innovationery.firebaseapp.com',
  projectId: 'innovationery',
  storageBucket: 'innovationery.firebasestorage.app',
  messagingSenderId: '345044449457',
  appId: '1:345044449457:web:26d5a5e5004bf4a4c78a90',
  measurementId: 'G-0WG9BS4F2E',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const db = getFirestore(firebaseApp)
