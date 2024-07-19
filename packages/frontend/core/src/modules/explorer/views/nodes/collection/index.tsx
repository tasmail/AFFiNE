import {
  AnimatedCollectionsIcon,
  type DropTargetDropEvent,
  type DropTargetOptions,
  MenuIcon,
  MenuItem,
  toast,
} from '@affine/component';
import {
  filterPage,
  useEditCollection,
} from '@affine/core/components/page-list';
import { CollectionService } from '@affine/core/modules/collection';
import { FavoriteItemsAdapter } from '@affine/core/modules/properties';
import { ShareDocsService } from '@affine/core/modules/share-doc';
import type { AffineDNDData } from '@affine/core/types/dnd';
import type { Collection } from '@affine/env/filter';
import { PublicPageMode } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { FilterMinusIcon } from '@blocksuite/icons/rc';
import type { DocMeta } from '@blocksuite/store';
import {
  DocsService,
  GlobalContextService,
  LiveData,
  useLiveData,
  useService,
  useServices,
} from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ExplorerTreeNode, type ExplorerTreeNodeDropEffect } from '../../tree';
import type { NodeOperation } from '../../tree/types';
import { ExplorerDocNode } from '../doc';
import { Empty } from './empty';
import { useExplorerCollectionNodeOperations } from './operations';

export const ExplorerCollectionNode = ({
  collectionId,
  onDrop,
  location,
  reorderable,
  operations: additionalOperations,
  dropEffect,
}: {
  reorderable?: boolean;
  collectionId: string;
  location?: AffineDNDData['draggable']['from'];
  operations?: NodeOperation[];
  onDrop?: (data: DropTargetDropEvent<AffineDNDData>) => void;
  dropEffect?: ExplorerTreeNodeDropEffect;
}) => {
  const t = useI18n();
  const { globalContextService } = useServices({
    GlobalContextService,
  });
  const { open: openEditCollectionModal, node: editModal } =
    useEditCollection();
  const active =
    useLiveData(globalContextService.globalContext.collectionId.$) ===
    collectionId;
  const [collapsed, setCollapsed] = useState(true);

  const collectionService = useService(CollectionService);
  const collection = useLiveData(
    collectionService.collectionById(collectionId)
  );

  const dndData = useMemo(() => {
    return {
      draggable: {
        entity: {
          type: 'collection',
          id: collectionId,
        },
        from: location,
      },
      dropTarget: {
        at: 'explorer:doc',
      },
    } satisfies AffineDNDData;
  }, [collectionId, location]);

  const handleRename = useCallback(
    (name: string) => {
      if (collection) {
        collectionService.updateCollection(collectionId, () => ({
          ...collection,
          name,
        }));
        toast(t['com.affine.toastMessage.rename']());
      }
    },
    [collection, collectionId, collectionService, t]
  );

  const handleAddDocToCollection = useCallback(
    (docId: string) => {
      if (!collection) {
        return;
      }
      if (collection.allowList.includes(docId)) {
        toast(t['com.affine.collection.addPage.alreadyExists']());
      } else {
        collectionService.addPageToCollection(collection.id, docId);
      }
    },
    [collection, collectionService, t]
  );

  const handleDropOnCollection = useCallback(
    (data: DropTargetDropEvent<AffineDNDData>) => {
      if (collection && data.treeInstruction?.type === 'make-child') {
        if (data.source.data.entity?.type === 'doc') {
          handleAddDocToCollection(data.source.data.entity.id);
        }
      } else {
        onDrop?.(data);
      }
    },
    [collection, onDrop, handleAddDocToCollection]
  );

  const handleDropEffectOnCollection = useCallback<ExplorerTreeNodeDropEffect>(
    data => {
      if (collection && data.treeInstruction?.type === 'make-child') {
        if (data.source.data.entity?.type === 'doc') {
          return 'link';
        }
      } else {
        return dropEffect?.(data);
      }
      return;
    },
    [collection, dropEffect]
  );

  const handleDropOnPlaceholder = useCallback(
    (data: DropTargetDropEvent<AffineDNDData>) => {
      if (collection && data.source.data.entity?.type === 'doc') {
        handleAddDocToCollection(data.source.data.entity.id);
      }
    },
    [collection, handleAddDocToCollection]
  );

  const handleOpenCollapsed = useCallback(() => {
    setCollapsed(false);
  }, []);

  const handleEditCollection = useCallback(() => {
    if (!collection) {
      return;
    }
    openEditCollectionModal(collection)
      .then(collection => {
        return collectionService.updateCollection(
          collection.id,
          () => collection
        );
      })
      .catch(err => {
        console.error(err);
      });
  }, [collection, collectionService, openEditCollectionModal]);

  const collectionOperations = useExplorerCollectionNodeOperations(
    collectionId,
    handleOpenCollapsed,
    handleEditCollection
  );

  const finalOperations = useMemo(() => {
    if (additionalOperations) {
      return [...additionalOperations, ...collectionOperations];
    }
    return collectionOperations;
  }, [collectionOperations, additionalOperations]);

  const handleCanDrop = useMemo<DropTargetOptions<AffineDNDData>['canDrop']>(
    () => args => args.source.data.entity?.type === 'doc',
    []
  );

  if (!collection) {
    return null;
  }

  return (
    <>
      <ExplorerTreeNode
        icon={({ draggedOver, className, treeInstruction }) => (
          <AnimatedCollectionsIcon
            className={className}
            closed={!!draggedOver && treeInstruction?.type === 'make-child'}
          />
        )}
        name={collection.name || t['Untitled']()}
        dndData={dndData}
        onDrop={handleDropOnCollection}
        renameable
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        to={`/collection/${collection.id}`}
        active={active}
        canDrop={handleCanDrop}
        reorderable={reorderable}
        onRename={handleRename}
        childrenPlaceholder={<Empty onDrop={handleDropOnPlaceholder} />}
        operations={finalOperations}
        dropEffect={handleDropEffectOnCollection}
      >
        <ExplorerCollectionNodeChildren collection={collection} />
      </ExplorerTreeNode>
      {editModal}
    </>
  );
};

const ExplorerCollectionNodeChildren = ({
  collection,
}: {
  collection: Collection;
}) => {
  const t = useI18n();
  const {
    docsService,
    favoriteItemsAdapter,
    shareDocsService,
    collectionService,
  } = useServices({
    DocsService,
    FavoriteItemsAdapter,
    ShareDocsService,
    CollectionService,
  });

  useEffect(() => {
    // TODO(@eyhn): loading & error UI
    shareDocsService.shareDocs?.revalidate();
  }, [shareDocsService]);

  const docMetas = useLiveData(
    useMemo(
      () =>
        LiveData.computed(get => {
          return get(docsService.list.docs$).map(
            doc => get(doc.meta$) as DocMeta
          );
        }),
      [docsService]
    )
  );
  const favourites = useLiveData(favoriteItemsAdapter.favorites$);
  const allowList = useMemo(
    () => new Set(collection.allowList),
    [collection.allowList]
  );
  const shareDocs = useLiveData(shareDocsService.shareDocs?.list$);

  const handleRemoveFromAllowList = useCallback(
    (id: string) => {
      collectionService.deletePageFromCollection(collection.id, id);
      toast(t['com.affine.collection.removePage.success']());
    },
    [collection.id, collectionService, t]
  );

  const filtered = docMetas.filter(meta => {
    if (meta.trash) return false;
    const publicMode = shareDocs?.find(d => d.id === meta.id)?.mode;
    const pageData = {
      meta: meta as DocMeta,
      publicMode:
        publicMode === PublicPageMode.Edgeless
          ? ('edgeless' as const)
          : publicMode === PublicPageMode.Page
            ? ('page' as const)
            : undefined,
      favorite: favourites.some(fav => fav.id === meta.id),
    };
    return filterPage(collection, pageData);
  });

  return filtered.map(doc => (
    <ExplorerDocNode
      key={doc.id}
      docId={doc.id}
      reorderable={false}
      location={{
        at: 'explorer:collection:filtered-docs',
        collectionId: collection.id,
      }}
      operations={
        allowList
          ? [
              {
                index: 99,
                view: (
                  <MenuItem
                    preFix={
                      <MenuIcon>
                        <FilterMinusIcon />
                      </MenuIcon>
                    }
                    onClick={() => handleRemoveFromAllowList(doc.id)}
                  >
                    {t['Remove special filter']()}
                  </MenuItem>
                ),
              },
            ]
          : []
      }
    />
  ));
};
