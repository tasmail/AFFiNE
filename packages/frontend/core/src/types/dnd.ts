import type { DNDData } from '@affine/component';

export interface AffineDNDData extends DNDData {
  draggable: {
    entity?:
      | {
          type: 'doc';
          id: string;
        }
      | {
          type: 'folder';
          id: string;
        }
      | {
          type: 'collection';
          id: string;
        };
    from?:
      | {
          at: 'explorer:organize:folder-node';
          nodeId: string;
        }
      | {
          at: 'explorer:collection:list';
        }
      | {
          at: 'explorer:doc:linked-docs';
          docId: string;
        }
      | {
          at: 'explorer:collection:filtered-docs';
          collectionId: string;
        }
      | {
          at: 'explorer:favorite:items';
        }
      | {
          at: 'all-docs:list';
        };
  };
  dropTarget:
    | {
        at: 'explorer:organize:root';
      }
    | {
        at: 'explorer:organize:folder';
      }
    | {
        at: 'explorer:doc';
      }
    | {
        at: 'app-sidebar:trash';
      }
    | Record<string, unknown>;
}
