interface MemoizationProtocol<
	MemoizedData extends object,
	Argv extends unknown[],
	StorageKeySource extends string = string,
> {
	(storage: Map<StorageKeySource, MemoizedData>, ...args: Argv): MemoizedData;
}

export function memoizationFactory<
	MemoizedData extends object,
	Argv extends unknown[],
	StorageKeySource extends string = string,
>(executor: MemoizationProtocol<MemoizedData, Argv, StorageKeySource>) {
	return function memoizationCreator() {
		const storage = new Map<StorageKeySource, MemoizedData>();

		return {
			push(...args: [id: StorageKeySource, data: MemoizedData][]) {
				for (const [id, data] of args) {
					storage.set(id, data);
				}
			},
			process(...args: Argv) {
				return executor(storage, ...args);
			},
			get(id: StorageKeySource): MemoizedData | undefined {
				let data: MemoizedData | undefined;

				if (!(data = storage.get(id))) {
					return undefined;
				}

				return data;
			},
			getAll() {
				return Object.fromEntries(storage);
			},
			get size() {
				return storage.size;
			},
		};
	};
}
