const concatStream = require('concat-stream')
const Readable = require('stream').Readable
const path = require("path");
const fs = require("fs-extra");

class SolidFileStorage {
  constructor() {
    this.prefix = "file"
    this.name = "solid-rest-file-storage-1.0.0"
  }

  _makeStream(text){
    if (typeof text === 'object' && typeof text.stream === 'function') {
      return text.stream()
    }
       let s = new Readable
       s.push(text)
       s.push(null)  
       return s;
 }
 async text (stream) {
  return new Promise((resolve, reject) => {
    stream = stream || ""
    if(typeof stream === "string") return resolve(stream);
    stream.pipe(concatStream({
      encoding: 'string'
    }, resolve())).catch(e=>{console.log(e); reject()})
    stream.on('error', reject())
  })
}
 async json (stream) {
    return text(stream).then(text => JSON.parse(text))
}

async  getObjectType(fn,options){
    let stat;
    try { stat = fs.lstatSync(fn); }
    catch(err){ }
    let type   = ( stat && stat.isDirectory()) ? "Container" : "Resource";
    if(!stat && fn.endsWith('/')) type = "Container"
    return Promise.resolve( [type,stat] )
}

async getResource(pathname,options,objectType){
//   const bodyData = await fs.createReadStream(pathname)
  const bodyData = await fs.readFile(pathname)
  return [
    200,
    bodyData
  ]
}

/*
    options.body = options.body || ""
//    if(!options.body.pipe){
        try {
//          var opts = {encoding:'utf-8', flag:'w'};
//          var opts = {encoding:'base64', flag:'w'};
//          await fs.writeFileSync(pathname,options.body,opts)
          await fs.writeFileSync(pathname,options.body)
          return resolve([201])
        }
        catch(e){console.log(e); return resolve([500])}
//    }
*/

async putResource(pathname,options){
    let successCode = (options.objectExists) ? 200 : 201;
    let failureCode = 
        ( options.method==="PUT" && options.objectType==="Container" )
        ? 409 : 500
    return new Promise(async (resolve) => {
        let writeIt=false
        if(failureCode===409) return resolve( [failureCode] )
        if(typeof options.body==="undefined") options.body = ""
        if(typeof options.body==="string"){
          writeIt=true
        }
        else if(options.body.stream){
            options.body = await options.body.stream()
            options.body = await options.body.read()
            writeIt=true
        }
        else if(options.body.text){
            options.body = await options.body.text()
            writeIt=true
        }
        if(writeIt){
            try {
                await fs.writeFileSync(pathname,options.body)
                return resolve([successCode])
            }
            catch(e){ console.log(e); return resolve([failureCode])}
        }
        if(!options.body.pipe && typeof FileReader !="undefined"){
            var fileReader = new FileReader();
            fileReader.onload = function() {
                fs.writeFileSync(pathname, Buffer.from(
                     new Uint8Array(this.result))
                )
            }
            fileReader.onloadend = () => {return resolve([successCode])}
            fileReader.onerror = (err) => {
                console.log(err);
                return resolve([failureCode])
            }
            fileReader.readAsArrayBuffer(options.body);
        }
        else {
            options.body = options.body || ""
            options.body = this._makeStream( options.body );
            options.body.pipe(fs.createWriteStream(pathname)).on('finish',()=>{
                return resolve( [successCode] )
            }).on('error', (err) => { 
                console.log(err)
                return resolve( [failureCode] )
            })
        }
    })
}
/*
async putResource(pathname,options){
  return new Promise(async (resolve) => {
    options.body = this._makeStream( options.body );
    if(options.body.pipeTo){
      let response=await options.body.pipeTo(fs.createWriteStream(pathname))
      console.log(response)
      if(response.ok) resolve( [201] )
      else { resolve ( [500] ) }
    }
  })
}
*/
/*
        options.body.pipe(fs.createWriteStream(pathname)).on('finish',()=>{
          resolve( [201] )
        }).on('error', (err) => { 
          if(options.method==="PUT" && options.objectType==="Container")
            resolve( [405] )
          resolve( [500] )
        })
*/

async deleteResource(fn){
    return new Promise(function(resolve) {
        fs.unlink( fn, function(err) {
            if(err)  resolve( [409] );
            else     resolve( [200] );
        });
    });
}
deleteContainer(fn){
    return new Promise(function(resolve) {
        fs.rmdir( fn, function(err) {
            if(err) {
                resolve( [409] );
            } else {
                resolve( [200] );
            }
        });
    });
}
postContainer(fn,options){
  fn = fn.replace(/\/$/,'');
  return new Promise(function(resolve) {
    if(fs.existsSync(fn)){
      return resolve( [201] )
    }
    fs.mkdirp( fn, {}, (err) => {
      if(err) {
        return resolve( [500] )
      } 
      else {
        return resolve( [201] )
      }
    });
  });
}
async makeContainers(pathname,options){
      let filename = path.basename(pathname);
      let reg = new RegExp(filename+"\$")
      let foldername = pathname.replace(reg,'');
      let [t,exists] = await this.getObjectType(foldername);
      if(t==="Resource") return Promise.resolve([200])
      if(exists) return Promise.resolve([200])
      foldername = foldername.replace(/\/$/,'');
      await fs.mkdirpSync( foldername, {}, (err) => {
        if(err) return Promise.resolve( 500 )
        else    return Promise.resolve( 201 )
      })
      return Promise.resolve([200])
}
async getContainer(pathname,options) {
  return await fs.readdirSync(pathname)
}

}
module.exports = SolidFileStorage
