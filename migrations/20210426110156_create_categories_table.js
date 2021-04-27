
exports.up = async function (knex) {
    await knex.schema.createTable('categories', table => {
        table.bigInteger('id')
            .notNullable()
            .primary();

        table.bigInteger('root_id')
            .notNullable()
            .references('categories.id')
            .onDelete('cascade')
            .onUpdate('cascade');

        table.bigInteger('parent_id')
            .nullable()
            .references('categories.id')
            .onDelete('restrict')
            .onUpdate('cascade');

        table.integer('ns_left')
            .index();

        table.integer('ns_right')
            .index();

        table.string('display_name')
            .notNullable();

        table.string('context_free_name')
            .notNullable();

        table.timestamps(true);
    });
};

exports.down = function (knex) {

};
