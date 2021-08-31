const os = require("os");
const getCert = require("./getCerts");

module.exports = async (ipv6 = false)=>{
  var ifaces = os.networkInterfaces();
  var ipArr = [];
  // 1. 申请域名解析
  // 2. 返回可用的域名
  for(var dev in ifaces){
    for (var id in ifaces[dev]){
      const details = ifaces[dev][id];
      if (details.address && details.address !== "127.0.0.1"){
        if (!ipv6 && details.family === "IPv4"){
          ipArr.push(details.address)
        }
        if (ipv6 && details.family === "IPv6"){
          ipArr.push(details.address)
        }
        // const domain = `ip-${details.address.replace(/\./g, "-")}.wrtc.dev`;
        // if (details.address !== "127.0.0.1"){
        //   getCerts(details.address);
        //   try{
        //     const info = await axios.get(`https://${domain}:${port}/badcertinfo.json`)
        //     if (info.data.id === instanceId){
        //       console.log(`Available https://${domain}:${port}`);
        //       if (!selectedDomain){
        //         selectedDomain = domain;
        //       }
        //     }else{
        //       console.log(`wrong domain https://${domain}:${port} (ID ${info.data.id} should be ${instanceId})`)
        //     }
        //   }catch(e){
        //     console.log(`Not available for now ${domain}`)
        //   }
        // }
      }
    }
  }
  const info = await getCert(ipArr, false);
  return info;
}
