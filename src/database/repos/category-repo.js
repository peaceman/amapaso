const Category = require('../models/Category');
const { raw } = require('objection');
const { subDays } = require('date-fns');

class CategoryRepo {
    /**
     * Inserts/Updates the given category
     *
     * @param {Category} category
     */
    async save(category) {
        await Category.transaction(async trx => {
            const existingCategory = await Category.query(trx)
                .forUpdate()
                .findById(category.id);

            if (existingCategory) {
                return await existingCategory.$query(trx)
                    .updateAndFetch(category);
            } else {
                await category.$query(trx)
                    .insert();

                return category;
            }
        });
    }

    async rebuildNestedSet() {
        const roots = await Category.query()
            .where('id', raw('root_id'));

        for (const root of roots) {
            await this.rebuildNestedSetFromRoot(root);
        }
    }

    /**
     * @param {Category} root
     */
    async rebuildNestedSetFromRoot(root) {
        await Category.transaction(async trx => {
            // clear current nested set values
            await Category.query(trx)
                .patch({nsLeft: null, nsRight: null})
                .where('root_id', '=', root.id)
                .forUpdate();

            await root.$query(trx)
                .patch({nsLeft: 1, nsRight: 2});

            const queue = [root.id];
            while (queue.length) {
                const parentId = queue.shift();

                // fetch direct childs
                const childs = await Category.query(trx)
                    .where({
                        parent_id: parentId,
                        root_id: root.id,
                    });

                for (const child of childs) {
                    const {nsLeft: parentLeft, nsRight: parentRight} = await Category.query(trx)
                        .findOne({id: parentId})
                        .columns('ns_left', 'ns_right');

                    await Category.query(trx)
                        .patch({nsRight: raw('ns_right + 2')})
                        .where('ns_right', '>=', parentRight)
                        .where('root_id', '=', root.id);

                    await Category.query(trx)
                        .patch({nsLeft: raw('ns_left + 2')})
                        .where('ns_left', '>', parentRight)
                        .where('root_id', '=', root.id);

                    await child.$query(trx)
                        .patch({nsLeft: parentRight, nsRight: parentRight + 1});

                    queue.push(child.id);
                }
            }
        });
    }

    async fetchEligibleForPeriodicProductsImport({ limit = 10, daysSinceLastQueueing = 7 } = {}) {
        const categories = await Category.query()
            .leftJoin('category_product_imports as cip', 'cip.id', function () {
                this.select('cipi.id')
                    .from('category_product_imports as cipi')
                    .where('cipi.category_id', '=', raw('categories.id'))
                    .orderBy('cipi.queued_at', 'desc')
                    .limit(1)
            })
            .where(function () {
                this.whereNull('cip.queued_at')
                    .orWhere('cip.queued_at', '<=', subDays(new Date(), daysSinceLastQueueing));
            })
            .limit(limit);

        return categories;
    }

    /**
     * @param {Category} category
     */
    async markQueuedProductsImport(category) {
        await category.$relatedQuery('productImports')
            .insert({
                queuedAt: new Date().toISOString(),
            });
    }
}

module.exports = {
    CategoryRepo,
};
