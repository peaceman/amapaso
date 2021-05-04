
exports.up = async function(knex) {
    await knex.schema.createTable('category_product_imports', table => {
        table.bigIncrements()
            .notNullable();

        table.bigInteger('category_id')
            .notNullable()
            .references('categories.id')
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
    })
};

exports.down = function(knex) {

};
