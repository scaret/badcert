const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');

const getCerts = async (ip, force)=>{
    const pathDir = path.join(os.homedir(), '.badcert', ip);
    let config;
    if (force){
        return requestCerts(ip);
    }
    try{
        const configJSON = fs.readFileSync(path.join(pathDir, 'config.json'));
        config = JSON.parse(configJSON);
    }catch(e){
        console.log(`Retriving new record for ${ip}`)
        return requestCerts(ip);
    }
    const expireDate = new Date(config.expires);
    if (expireDate.getTime() - Date.now() < 7 * 24 * 3600000){
        console.log(`Cert expires in 7 days. Retriving...`);
        return requestCerts(ip);
    }
    return {
        ip: ip,
        domain: config.domain,
        expires: config.expires,
        keyPath: path.join(pathDir, 'key.pem'),
        certPath: path.join(pathDir, 'cert.pem')
    }
}

const requestCerts = async (ip)=>{
    const response = await axios.get(`https://api.wrtc.dev/addIpRecord?ip=${encodeURI(ip)}`);
    const data = response.data;
    const pathDir = path.join(os.homedir(), '.badcert', ip);
    fs.mkdirSync(pathDir, {recursive: true});
    fs.writeFileSync(path.join(pathDir, 'cert.pem'), data.cert);
    fs.writeFileSync(path.join(pathDir, 'key.pem'), data.key);
    fs.writeFileSync(path.join(pathDir, 'config.json'), JSON.stringify({
        domain: data.domain,
        expires: data.expires,
    }, null, 2));
    return {
        ip: ip,
        domain: data.domain,
        keyPath: path.join(pathDir, 'key.pem'),
        certPath: path.join(pathDir, 'cert.pem'),
        expires: data.expires
    };
};

module.exports = getCerts
