interface MemoizationProtocol<MemoizedData extends object, Argv extends unknown[]> {
	(storage: Map<string, MemoizedData>, ...args: Argv): MemoizedData;
}

export function memoizationFactory<MemoizedData extends object, Argv extends unknown[]>(
	executor: MemoizationProtocol<MemoizedData, Argv>,
) {
	return function memoizationCreator() {
		const storage = new Map<string, MemoizedData>();

		return {
			process(...args: Argv) {
				return executor(storage, ...args);
			},
			get(id: string): MemoizedData | undefined {
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
