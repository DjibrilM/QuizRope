import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('FirebaseConfig');

let firebaseApp: any = null;
export let isFirebaseConfigured = false;

export function initializeFirebase() {
  try {
    const admin = require('firebase-admin');

    // 1. Check for raw JSON string in env var
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      isFirebaseConfigured = true;
      logger.log('Firebase initialized successfully from FIREBASE_SERVICE_ACCOUNT_KEY');
      return firebaseApp;
    }

    // 2. Check for file path in env var or default file locations
    const possiblePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(process.cwd(), 'firebase-service-account.json'),
      path.resolve(process.cwd(), '..', 'serviceAccountKey.json'),
      path.resolve(process.cwd(), '..', 'firebase-service-account.json'),
    ].filter(Boolean) as string[];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        isFirebaseConfigured = true;
        logger.log(`Firebase initialized successfully from ${path.basename(filePath)}`);
        return firebaseApp;
      }
    }

    // 3. Check for individual env vars
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      isFirebaseConfigured = true;
      logger.log('Firebase initialized successfully from env vars');
      return firebaseApp;
    }

    logger.warn(
      'Missing Firebase configuration — auth will use mock mode. ' +
        'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY or provide serviceAccountKey.json.',
    );
    isFirebaseConfigured = false;
    return null;
  } catch (error) {
    logger.error('Firebase initialization failed:', error.message);
    isFirebaseConfigured = false;
    return null;
  }
}

export function getFirebaseApp() {
  return firebaseApp;
}
