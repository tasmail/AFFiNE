import {
  type DropTargetDropEvent,
  type DropTargetOptions,
  IconButton,
} from '@affine/component';
import { CategoryDivider } from '@affine/core/components/app-sidebar';
import {
  type ExplorerTreeNodeDropEffect,
  ExplorerTreeRoot,
} from '@affine/core/modules/explorer/views/tree';
import { FavoriteItemsAdapter } from '@affine/core/modules/properties';
import { WorkbenchService } from '@affine/core/modules/workbench';
import type { AffineDNDData } from '@affine/core/types/dnd';
import { useI18n } from '@affine/i18n';
import { PlusIcon } from '@blocksuite/icons/rc';
import { DocsService, useLiveData, useServices } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { ExplorerCollectionNode } from '../../nodes/collection';
import { ExplorerDocNode } from '../../nodes/doc';
import { RootEmpty } from './empty';
import * as styles from './styles.css';

export const ExplorerFavorites = () => {
  const { favoriteItemsAdapter, docsService, workbenchService } = useServices({
    FavoriteItemsAdapter,
    DocsService,
    WorkbenchService,
  });

  const docs = useLiveData(docsService.list.docs$);
  const trashDocs = useLiveData(docsService.list.trashDocs$);

  const favorites = useLiveData(
    favoriteItemsAdapter.orderedFavorites$.map(favs => {
      return favs.filter(fav => {
        if (fav.type === 'doc') {
          return (
            docs.some(doc => doc.id === fav.id) &&
            !trashDocs.some(doc => doc.id === fav.id)
          );
        }
        return true;
      });
    })
  );

  const t = useI18n();

  const handleDrop = useCallback(
    (data: DropTargetDropEvent<AffineDNDData>) => {
      if (data.source.data.entity?.type === 'doc') {
        favoriteItemsAdapter.set(data.source.data.entity.id, 'doc', true);
      }
    },
    [favoriteItemsAdapter]
  );

  const handleDropEffect = useCallback<ExplorerTreeNodeDropEffect>(data => {
    if (data.source.data.entity?.type === 'doc') {
      return 'link';
    }
    return;
  }, []);

  const handleCanDrop = useMemo<DropTargetOptions<AffineDNDData>['canDrop']>(
    () => data => {
      return data.source.data.entity?.type === 'doc';
    },
    []
  );

  const handleCreateNewFavoriteDoc = useCallback(() => {
    const newDoc = docsService.createDoc();
    favoriteItemsAdapter.set(newDoc.id, 'doc', true);
    workbenchService.workbench.openDoc(newDoc.id);
  }, [docsService, favoriteItemsAdapter, workbenchService]);

  const handleOnChildrenDrop = useCallback(
    (
      favorite: { id: string; type: 'doc' | 'collection' },
      data: DropTargetDropEvent<AffineDNDData>
    ) => {
      if (
        data.treeInstruction?.type === 'reorder-above' ||
        data.treeInstruction?.type === 'reorder-below'
      ) {
        if (
          data.source.data.from?.at === 'explorer:favorite:items' &&
          (data.source.data.entity?.type === 'doc' ||
            data.source.data.entity?.type === 'collection')
        ) {
          // is reordering
          favoriteItemsAdapter.sorter.moveTo(
            FavoriteItemsAdapter.getFavItemKey(
              data.source.data.entity.id,
              data.source.data.entity.type
            ),
            FavoriteItemsAdapter.getFavItemKey(favorite.id, favorite.type),
            data.treeInstruction?.type === 'reorder-above' ? 'before' : 'after'
          );
        } else if (
          data.source.data.entity?.type === 'doc' ||
          data.source.data.entity?.type === 'collection'
        ) {
          favoriteItemsAdapter.set(
            data.source.data.entity.id,
            data.source.data.entity?.type,
            true
          );
          favoriteItemsAdapter.sorter.moveTo(
            FavoriteItemsAdapter.getFavItemKey(
              data.source.data.entity.id,
              data.source.data.entity.type
            ),
            FavoriteItemsAdapter.getFavItemKey(favorite.id, favorite.type),
            data.treeInstruction?.type === 'reorder-above' ? 'before' : 'after'
          );
        }
      } else {
        return; // not supported
      }
    },
    [favoriteItemsAdapter]
  );

  const handleChildrenDropEffect = useCallback<ExplorerTreeNodeDropEffect>(
    data => {
      if (
        data.treeInstruction?.type === 'reorder-above' ||
        data.treeInstruction?.type === 'reorder-below'
      ) {
        if (
          data.source.data.from?.at === 'explorer:favorite:items' &&
          (data.source.data.entity?.type === 'doc' ||
            data.source.data.entity?.type === 'collection')
        ) {
          return 'move';
        } else if (
          data.source.data.entity?.type === 'doc' ||
          data.source.data.entity?.type === 'collection'
        ) {
          return 'link';
        }
      }
      return; // not supported
    },
    []
  );

  return (
    <div className={styles.container}>
      <CategoryDivider
        className={styles.draggedOverHighlight}
        label={t['com.affine.rootAppSidebar.favorites']()}
      >
        <IconButton
          data-testid="explorer-bar-add-favorite-button"
          onClick={handleCreateNewFavoriteDoc}
          size="small"
        >
          <PlusIcon />
        </IconButton>
      </CategoryDivider>
      <ExplorerTreeRoot
        placeholder={
          <RootEmpty
            onDrop={handleDrop}
            canDrop={handleCanDrop}
            dropEffect={handleDropEffect}
          />
        }
      >
        {favorites.map(favorite => (
          <ExplorerFavoriteNode
            key={favorite.id}
            favorite={favorite}
            onDrop={handleOnChildrenDrop}
            dropEffect={handleChildrenDropEffect}
          />
        ))}
      </ExplorerTreeRoot>
    </div>
  );
};

const childLocation = {
  at: 'explorer:favorite:items' as const,
};
const ExplorerFavoriteNode = ({
  favorite,
  onDrop,
  dropEffect,
}: {
  favorite: {
    id: string;
    type: 'collection' | 'doc';
  };
  onDrop: (
    favorite: {
      id: string;
      type: 'collection' | 'doc';
    },
    data: DropTargetDropEvent<AffineDNDData>
  ) => void;
  dropEffect: ExplorerTreeNodeDropEffect;
}) => {
  const handleOnChildrenDrop = useCallback(
    (data: DropTargetDropEvent<AffineDNDData>) => {
      onDrop(favorite, data);
    },
    [favorite, onDrop]
  );
  return favorite.type === 'doc' ? (
    <ExplorerDocNode
      key={favorite.id}
      docId={favorite.id}
      location={childLocation}
      onDrop={handleOnChildrenDrop}
      dropEffect={dropEffect}
    />
  ) : (
    <ExplorerCollectionNode
      key={favorite.id}
      collectionId={favorite.id}
      location={childLocation}
      onDrop={handleOnChildrenDrop}
      dropEffect={dropEffect}
    />
  );
};
