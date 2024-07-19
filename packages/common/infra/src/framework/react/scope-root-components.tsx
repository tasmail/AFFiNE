import React from 'react';

type NodesMap = Map<number | string, React.ReactNode>;

const ScopeRootComponentsContext = React.createContext<{
  nodes: NodesMap;
  setNodes: React.Dispatch<React.SetStateAction<NodesMap>>;
}>({ nodes: new Map(), setNodes: () => {} });

let _id = 0;
/**
 * A hook to add nodes to the nearest scope's root
 */
export const useScopeRootComponents = (customId?: string) => {
  const { setNodes } = React.useContext(ScopeRootComponentsContext);

  const remove = React.useCallback(
    (id: number | string) => {
      setNodes(prev => {
        if (!prev.has(id)) {
          return prev;
        }
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [setNodes]
  );

  const add = React.useCallback(
    (node: React.ReactNode) => {
      const id = customId ?? _id++;
      setNodes(prev => new Map(prev).set(id, node));

      return () => remove(id);
    },
    [customId, remove, setNodes]
  );

  return React.useMemo(() => {
    return {
      /**
       * Add a node to the nearest scope root
       * ```tsx
       * const { add } = useScopeRootComponents();
       * useEffect(() => {
       *  const remove = add(<div>Node</div>);
       *  return remove;
       * }, [])
       * ```
       * @return A function to remove the added node.
       */
      add,
    };
  }, [add]);
};

export const ScopeRootComponents = ({ children }: React.PropsWithChildren) => {
  const [nodes, setNodes] = React.useState<NodesMap>(new Map());

  return (
    <ScopeRootComponentsContext.Provider value={{ nodes, setNodes }}>
      {children}
      {Array.from(nodes.entries()).map(([id, node]) => (
        <React.Fragment key={id}>{node}</React.Fragment>
      ))}
    </ScopeRootComponentsContext.Provider>
  );
};
