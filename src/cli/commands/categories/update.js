const { importCategoryTree } = require('../../../import/category');

exports.command = 'update <file>';
exports.describe = 'uses the given file as base for an import of categories';
exports.builder = yargs => {
    yargs
        .positional('file', {
            describe: 'path to a csv file of the browse tree mapping',
            type: 'string',
        });
};

exports.handler = async argv => {
    await importCategoryTree.execute({
        csvFilePath: argv.file,
    });

    // redis seems to block the process exit
    process.exit();
};
