type SettledResult<T> = PromiseSettledResult<T>;

export function countUpSettled<T>(results: SettledResult<T>[]) {
    let success = 0;
    let fail = 0;

    results.forEach(result => {
        if (result.status === 'rejected' || (result.value as any).status === false) fail += 1;
        else success += 1;
    });

    return { success, fail };
}
