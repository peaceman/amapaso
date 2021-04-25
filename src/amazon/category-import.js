const log = require("../log");

async function extractFirstChildNodePerPerRootNode(columnMappings, dataGenerator) {
    const childNodes = new Map();

    for await (const row of dataGenerator) {
        const mappedRow = Object.entries(columnMappings)
            .reduce((prev, [name, idx]) => ({...prev, [name]: row[idx]}), {});

        // skip incomplete rows
        if (Object.values(mappedRow).findIndex(v => v === undefined) !== -1)
            continue;

        if (childNodes.has(mappedRow.rootNode))
            continue;

        childNodes.set(mappedRow.rootNode, mappedRow.childNode);
    }

    return [...childNodes.values()];
}

async function fetchRootNodeIdsFromChilds(apiClient, childNodeIds) {
    const browseNodesLimit = apiClient.getBrowseNodesLimit();

    // prevent argument mutation
    childNodeIds = childNodeIds.slice();
    const rootAncestors = [];

    while (childNodeIds.length) {
        const childNodeIdsChunk = childNodeIds.splice(0, browseNodesLimit);

        const browseNodes = await apiClient.getBrowseNodes(childNodeIdsChunk);
        rootAncestors.push(...browseNodes.map(bn => extractRootAncestorFromBrowseNode(bn)));
    }

    return rootAncestors
        .map(bn => bn['Id']);
}

function extractRootAncestorFromBrowseNode(browseNode) {
    let curr = browseNode;

    while (curr['Ancestor']) {
        curr = curr['Ancestor'];
    }

    return curr;
}

async function fetchAndStoreNodeHierarchy(apiClient, storeCategory, rootNodeIds) {
    const browseNodesLimit = apiClient.getBrowseNodesLimit();
    const visitedNodeIds = new Map();

    async function fetchAndStore(nodeIds, parentId = undefined) {
        // prevent argument mutation
        nodeIds = nodeIds.slice();
        // prevent duplicate fetches of node information
        // amazon seems to have a category under multiple parent categories
        // but with different names
        nodeIds = nodeIds.filter(v => {
            if (!visitedNodeIds.has(v)) {
                visitedNodeIds.set(v, true);
                return true;
            }

            return false;
        });

        const newFetchTasks = [];

        while (nodeIds.length) {
            const nodeIdsChunk = nodeIds.splice(0, browseNodesLimit);

            const browseNodes = await apiClient.getBrowseNodes(nodeIdsChunk);
            for (const parentNode of browseNodes) {
                // store the parent node only if it has no parent, parents will store their childs
                if (!parentId) {
                    await storeCategory(convertBrowseNodeToCategory(parentNode, parentId));
                }

                const childs = parentNode['Children'] || [];
                for (const child of childs) {
                    await storeCategory(convertBrowseNodeToCategory(child, parentNode['Id']));
                }

                const childIds = childs.map(n => n['Id']);
                newFetchTasks.push({parentId: parentNode['Id'], childIds});
            }
        }

        return newFetchTasks;
    }

    let fetchTasks = [{parentId: undefined, childIds: rootNodeIds}];
    while (fetchTasks.length) {
        const task = fetchTasks.shift();
        const newTasks = await fetchAndStore(task.childIds, task.parentId);

        fetchTasks.push(...newTasks);
    }
}

function convertBrowseNodeToCategory(browseNode, parentId = undefined) {
    return {
        id: browseNode['Id'],
        parentId: parentId,
        displayName: browseNode['DisplayName'],
        contextFreeName: browseNode['ContextFreeName'],
    };
}

module.exports = {
    extractFirstChildNodePerPerRootNode,
    fetchRootNodeIdsFromChilds,
    fetchAndStoreNodeHierarchy,
};
