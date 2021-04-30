const os = require("os");
const {Resolver} = require('dns').promises;
var resolver = new Resolver();
const getCerts = require("./getCerts");
const axios = require('axios');

module.exports = async (port, instanceId)=>{
  var ifaces = os.networkInterfaces();
  // 1. 申请域名解析
  // 2. 返回可用的域名
  let selectedDomain = null;
  for(var dev in ifaces){
    for (var id in ifaces[dev]){
      const details = ifaces[dev][id];
      if (details.family === 'IPv4'){
        const domain = `ip-${details.address.replace(/\./g, "-")}.wrtc.dev`;
        if (details.address !== "127.0.0.1"){
          getCerts(details.address);
          try{
            const info = await axios.get(`https://${domain}:${port}/badcertinfo.json`)
            if (info.data.id === instanceId){
              console.log(`Available https://${domain}:${port}`);
              if (!selectedDomain){
                selectedDomain = domain;
              }
            }else{
              console.log(`wrong domain https://${domain}:${port} (ID ${info.data.id} should be ${instanceId})`)
            }
          }catch(e){
            console.log(`Not available for now ${domain}`)
          }
        }
      }
    }
  }
  if (selectedDomain){
    return selectedDomain;
  }else{
    const domain = `ip-${'127.0.0.1'.replace(/\./g, "-")}.wrtc.dev`;
    return domain;
  }
}
