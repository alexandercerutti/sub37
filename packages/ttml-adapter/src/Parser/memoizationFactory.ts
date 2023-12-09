interface MemoizationProtocol<MemoizedData extends object, Argv extends unknown[]> {
	(storage: Map<string, MemoizedData>, ...args: Argv): MemoizedData;
}

export function memoizationFactory<MemoizedData extends object, Argv extends unknown[]>(
	executor: MemoizationProtocol<MemoizedData, Argv>,
) {
	return function memoizationCreator() {
		const storage = new Map<string, MemoizedData>();

		return (...args: Argv) => executor(storage, ...args);
	};
}
