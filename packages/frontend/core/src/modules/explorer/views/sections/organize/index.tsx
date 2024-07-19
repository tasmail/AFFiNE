import { type DropTargetDropEvent, IconButton, toast } from '@affine/component';
import { CategoryDivider } from '@affine/core/components/app-sidebar';
import {
  type ExplorerTreeNodeDropEffect,
  ExplorerTreeRoot,
} from '@affine/core/modules/explorer/views/tree';
import {
  type FolderNode,
  OrganizeService,
} from '@affine/core/modules/organize';
import type { AffineDNDData } from '@affine/core/types/dnd';
import { useI18n } from '@affine/i18n';
import { PlusIcon } from '@blocksuite/icons/rc';
import { useLiveData, useServices } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import { ExplorerFolderNode } from '../../nodes/folder';
import { RootEmpty } from './empty';
import * as styles from './styles.css';

export const ExplorerOrganize = () => {
  const { organizeService } = useServices({ OrganizeService });
  const [newFolderId, setNewFolderId] = useState<string | null>(null);

  const t = useI18n();

  const rootFolder = organizeService.rootFolder;

  const folders = useLiveData(rootFolder.sortedChildren$);

  const handleCreateFolder = useCallback(() => {
    const newFolderId = rootFolder.createFolder(
      'New Folder',
      rootFolder.indexAt('before')
    );
    setNewFolderId(newFolderId);
  }, [rootFolder]);

  const handleOnChildrenDrop = useCallback(
    (node: FolderNode, data: DropTargetDropEvent<AffineDNDData>) => {
      if (!node.id) {
        return; // never happens
      }
      if (
        data.treeInstruction?.type === 'reorder-above' ||
        data.treeInstruction?.type === 'reorder-below'
      ) {
        const at =
          data.treeInstruction?.type === 'reorder-below' ? 'after' : 'before';
        if (
          data.source.data.from?.at === 'explorer:organize:folder-node' &&
          data.source.data.entity?.type === 'folder'
        ) {
          rootFolder.moveHere(
            data.source.data.from.nodeId,
            rootFolder.indexAt(at, node.id)
          );
        } else {
          toast(t['com.affine.rootAppSidebar.organize.root-folder-only']());
        }
      } else {
        return; // not supported
      }
    },
    [rootFolder, t]
  );

  const handleChildrenDropEffect = useCallback<ExplorerTreeNodeDropEffect>(
    data => {
      if (
        data.treeInstruction?.type === 'reorder-above' ||
        data.treeInstruction?.type === 'reorder-below'
      ) {
        if (
          data.source.data.from?.at === 'explorer:organize:folder-node' &&
          data.source.data.entity?.type === 'folder'
        ) {
          return 'move';
        }
      } else {
        return; // not supported
      }
      return;
    },
    []
  );

  return (
    <div className={styles.container}>
      <CategoryDivider
        className={styles.draggedOverHighlight}
        label={t['com.affine.rootAppSidebar.organize']()}
      >
        <IconButton
          data-testid="explorer-bar-add-organize-button"
          onClick={handleCreateFolder}
          size="small"
        >
          <PlusIcon />
        </IconButton>
      </CategoryDivider>
      <ExplorerTreeRoot
        placeholder={<RootEmpty onClickCreate={handleCreateFolder} />}
      >
        {folders.map(child => (
          <ExplorerFolderNode
            key={child.id}
            node={child}
            defaultRenaming={child.id === newFolderId}
            onDrop={handleOnChildrenDrop}
            dropEffect={handleChildrenDropEffect}
          />
        ))}
      </ExplorerTreeRoot>
    </div>
  );
};
