export * from './core-v5/index.js';
export {createV5Session,createV5BrowserSession,createV5SaveRepository,decodeV5Save,V5_CODEC,V5_SAVE_KEY,V5_BACKUP_KEY} from './application/v5-persistence.js';
export type {V5Session,V5NewGameInput,V5ApplicationError,CollectionSnapshot,LegacyImportPreview,LegacyImportDecision,LegacyImportResult} from './application/v5-persistence.js';
export {createCollectionRepository,decodeCollection,validateCollection,collectionFromRun,collectionFromLegacy,mergeCollections,emptyCollection,collectionEligibility,COLLECTION_KEY,COLLECTION_BACKUP_KEY,COLLECTION_CODEC,decodeLegacyCollection,createLegacyCollectionSource,LEGACY_COLLECTION_KEY,LEGACY_COLLECTION_BACKUP_KEY} from './application/v5-collection.js';
export type {CollectionState,CollectionWork,CollectionRepository,LegacyCollectionSource} from './application/v5-collection.js';
