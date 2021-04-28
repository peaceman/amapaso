const Category = require('../models/Category');

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
}

module.exports = {
    CategoryRepo,
};
