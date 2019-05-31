module.exports = {
	mongo: {
		host: 'MONGO_HOST', // Host1[:port1][,host2[:port2]] (e.g. host1:1234,host2:1234)
		db: 'MONGO_DB',
		connectTimeoutMs: 'MONGO_CONNECT_TIMEOUT_MS',
		socketTimeoutMs: 'MONGO_SOCKET_TIMEOUT_MS',
		poolSize: 'MONGO_POOL_SIZE',
		replicaSet: 'MONGO_REPLICA_SET'
	}
}
