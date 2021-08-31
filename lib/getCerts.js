const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');

const pathDir = path.join(os.homedir(), '.badcert', "127.0.0.1");

const getCerts = async (ipArr = [], force = false)=>{
    let config;
    if (force){
        return requestCert(ipArr);
    }
    try{
        const configJSON = fs.readFileSync(path.join(pathDir, 'config.json'));
        config = JSON.parse(configJSON);
    }catch(e){
        console.log(`Retriving new record for ${ipArr.join(",")}`)
        return requestCert(ipArr);
    }
    if (!config.expires || !config.ipMap){
      console.log(`config file outdated. Retriving...`);
      return requestCert(ipArr);
    }
    const expireDate = new Date(config.expires);
    if (expireDate.getTime() - Date.now() < 7 * 24 * 3600000){
        console.log(`Cert expires in 7 days. Retriving...`);
        return requestCert(ipArr);
    }
    for (let ip of ipArr){
      if (!config.ipMap[ip]){
        console.log(`Detected IP address: ${ip}. Registering DNS infomation`);
        return requestCert(ipArr);
      }
    }
    return {
        ipMap: config.ipMap,
        expires: config.expires,
        keyPath: path.join(pathDir, 'key.pem'),
        certPath: path.join(pathDir, 'cert.pem')
    }
}

const requestCert = async (ipArr)=>{
    let config = {}
    try{
      const configJSON = fs.readFileSync(path.join(pathDir, 'config.json'));
      config = JSON.parse(configJSON);
    }catch(e){
    }

    const url = `https://api-gateway.wrtc.dev/addIpRecord?ip=${encodeURIComponent(ipArr.join(","))}`;
    const response = await axios.get(url);
    const data = response.data;
    if (data.err){
      console.error(err);
    }
    if (!data.cert || !data.key || !data.data || !data.expires){
      return;
    }
    fs.mkdirSync(pathDir, {recursive: true});
    fs.writeFileSync(path.join(pathDir, 'cert.pem'), data.cert);
    fs.writeFileSync(path.join(pathDir, 'key.pem'), data.key);
    config.ipMap = data.data;
    config.expires = data.expires;
    fs.writeFileSync(path.join(pathDir, 'config.json'), JSON.stringify(config, null, 2));
    return {
        ipMap: data.data,
        keyPath: path.join(pathDir, 'key.pem'),
        certPath: path.join(pathDir, 'cert.pem'),
        expires: data.expires
    };
};

module.exports = getCerts
