export function useTicTacToeRules() {
  const autoPlayRule = {
    key: 'play',
    homomorphic: false,
    patternGraph: {
      options: {
        type: 'directed',
      },
      nodes: [
        {
          key: 'A',
          attributes: {
            type: 'field',
          },
        },
        {
          key: 'state',
          attributes: {
            type: 'state',
          },
        },
      ],
      edges: [],
      nacs: [
        {
          nodes: [
            {
              key: 'A',
              attributes: {
                mark: ['X', 'O'],
              },
            },
          ],
          edges: [],
        },
      ],
    },
    replacementGraph: {
      options: {
        type: 'directed',
      },
      nodes: [
        {
          key: 'A',
          attributes: {
            mark: {
              type: 'jsonLogic',
              args: {
                rule: {
                  if: [
                    {
                      '==': ["$.nodes.[?(@.key === 'state')].attributes.currentSymbol", 'X'],
                    },
                    'O',
                    {
                      '==': ["$.nodes.[?(@.key === 'state')].attributes.currentSymbol", 'O'],
                    },
                    'X',
                    { var: '' },
                  ],
                },
              },
            },
          },
        },
        {
          key: 'state',
          attributes: {
            type: 'state',
            currentSymbol: {
              type: 'jsonLogic',
              args: {
                rule: {
                  if: [
                    {
                      '==': ["$.nodes.[?(@.key === 'state')].attributes.currentSymbol", 'X'],
                    },
                    'O',
                    {
                      '==': ["$.nodes.[?(@.key === 'state')].attributes.currentSymbol", 'O'],
                    },
                    'X',
                    { var: '' },
                  ],
                },
              },
            },
          },
        },
      ],
      edges: [],
    },
  }

  const autoPlayRuleBlockUser = {
    key: 'play',
    homomorphic: false,
    patternGraph: {
      options: {
        type: 'undirected',
      },
      nodes: [
        {
          key: 'A',
          attributes: {
            type: 'field',
            mark: 'X',
          },
        },
        {
          key: 'B',
          attributes: {
            type: 'field',
            mark: 'X',
          },
        },
        {
          key: 'C',
          attributes: {
            type: 'field',
          },
        },
      ],
      edges: [
        {
          key: 'aToB',
          source: 'A',
          target: 'B',
          attributes: {
            direction: 'down',
          },
        },
        {
          key: 'bToC',
          source: 'B',
          target: 'C',
          attributes: {
            direction: 'down',
          },
        },
      ],
      nacs: [
        {
          nodes: [
            {
              key: 'C',
              attributes: {
                mark: ['X', 'O'],
              },
            },
          ],
          edges: [],
        },
      ],
    },
  }

  const emptyRule = {
    key: 'play',
    homomorphic: false,
    patternGraph: {
      options: {
        type: 'directed',
      },
      nodes: [],
      edges: [],
      nacs: [],
    },
    replacementGraph: {
      options: {
        type: 'directed',
      },
      nodes: [],
      edges: [],
    },
  }

  const threeConnectedRule = {
    key: 'play',
    homomorphic: false,
    patternGraph: {
      options: {
        type: 'directed',
      },
      nodes: [
        {
          key: 'node1',
          attributes: {
            type: 'field',
            mark: 'X',
          },
        },
        {
          key: 'node2',
          attributes: {
            type: 'field',
            mark: 'X',
          },
        },
        {
          key: 'node3',
          attributes: {
            type: 'field',
            mark: 'X',
          },
        },
      ],
      edges: [
        {
          key: 'n1Ton2',
          source: 'node1',
          target: 'node2',
          attributes: {
            direction: 'down',
          },
        },
        {
          key: 'n2Ton3',
          source: 'node2',
          target: 'node3',
          attributes: {
            direction: 'down',
          },
        },
      ],
    },
  }

  return { autoPlayRule, autoPlayRuleBlockUser, emptyRule, threeConnectedRule }
}
