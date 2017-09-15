exports.DocDbRootQuery = 'SELECT * FROM root r WHERE r.id = @id';
exports.DocDbRetrieveQuery = 'SELECT VALUE r FROM root r WHERE CONTAINS(r.id, @id)';
exports.DocDbIdParam = '@id';