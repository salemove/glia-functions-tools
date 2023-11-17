const onlyDigits = (str) => {
    console.log('str= ', str);
    const result = str.replace(/\D/g, '');
    console.log('result= ', result);
    return result;
}

// const identity = i => i;
// const leftToRightComposition = (f, g) => (x) => g(f(x));
// const pipe = (functions) => functions.reduce(identity, leftToRightComposition);

const pipe = (...fns) =>
  (value) =>
    fns.reduce((acc, fn) => fn(acc), value);

export {
    onlyDigits,
    pipe
}