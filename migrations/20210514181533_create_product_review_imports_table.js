
exports.up = async function(knex) {
    await knex.schema.createTable('product_review_imports', table => {
        table.bigIncrements()
            .notNullable();

        table.string('product_asin', 10)
            .notNullable()
            .references('products.asin')
            .onDelete('cascade')
            .onUpdate('cascade');

        table.datetime('queued_at')
            .index()
            .notNullable();

        table.datetime('started_at')
            .index()
            .nullable();

        table.datetime('stopped_at')
            .index()
            .nullable();

        table.timestamps(true);
    });
};

exports.down = function(knex) {

};
