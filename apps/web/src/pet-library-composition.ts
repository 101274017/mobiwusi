import { IndexedDbRepository } from '@nuanban/local-data';
import { PetLibraryStore } from './pet-library-store';

export const petLibrary = new PetLibraryStore(new IndexedDbRepository());
