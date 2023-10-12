import jwt from 'jsonwebtoken';

function splitEmail(email) {
    // Extract the part before the '@' symbol
    let namePart = email.split('@')[0];
    
    // Use a regular expression to split the name part based on any punctuation mark
    let parts = namePart.split(/[\.\-_]+/);

    // Capitalize the first letter of each part
    let capitalizedParts = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1));

    // Create the result object
    let resultObj = {
        first: capitalizedParts[0] || "",
        last: capitalizedParts[1] || "",
        result: capitalizedParts.join(' ')
    };

    return resultObj;
}

export default function createJwt(email) {
    try {
        const privateKey = `-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIHOr1umzeMBQSJoRk4XORG6d4ONRuV161G6FFzROP+F3oAoGCCqGSM49AwEHoUQDQgAEtYWowh2mSIdm/u4DzK3msvTLet1DMKyVtj71Jncj8UVqKvNB+yeqpUQNywS0gJEO7UHVQt2I+GItnMCsQwJvlg==\n-----END EC PRIVATE KEY-----`
        console.log('private key: ', privateKey)
        const {first, last, result } = splitEmail(email);
        console.log(first, last, result);
        const claims = {
            name: result,
            given_name: first,
            family_name: last,
            email: email,
            sub: email.split('@')[0],
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            iat: Math.floor(Date.now() / 1000)
            };
        const token = jwt.sign(claims, privateKey, {algorithm: 'ES256'});
        return token
    } catch(error) {
        console.log(error)
        return jwt.sign({
            name: 'John Smith',
            given_name: 'John',
            family_name: 'Smith',
            email: 'john.smith@example.com',
            sub: 'john.smith',
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            iat: Math.floor(Date.now() / 1000)
          }, privateKey, {algorithm: 'ES256'});
    }
};