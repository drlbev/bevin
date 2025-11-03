// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzWv--y2ZQogPulazUCvNW_WmfuT0X9kE",
  authDomain: "bevin-48e4c.firebaseapp.com",
  projectId: "bevin-48e4c",
  storageBucket: "bevin-48e4c.firebasestorage.app",
  messagingSenderId: "379157128257",
  appId: "1:379157128257:web:e79218cb46be3818d912c0"
};

// Initialize Firebase  
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Collections
const postsCollection = db.collection('posts');
const draftsCollection = db.collection('drafts');