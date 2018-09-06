const net = require('net')

/**
 * Retrieves the status of a minecraft server.
 *
 * @param {string} address The server address.
 * @param {number} port Optional. The port of the server. Defaults to 25565.
 * @returns {Promise.<Object>} A promise which resolves to an object containing
 * status information.
 */
exports.getStatus = function(address, port = 3724){

    if(port == null || port == ''){
        port = 3725
    }
    if(typeof port === 'string'){
        port = parseInt(port)
    }

    return new Promise((resolve, reject) => {
        const socket = net.connect(port, address, () => {
            let buff = new Buffer([0xFE, 0x01])
            socket.write(buff)
        })

        socket.setTimeout(2500, () => {
            socket.end()
            reject({
                code: 'ETIMEDOUT',
                errno: 'ETIMEDOUT',
                address,
                port
            })
        })

        socket.on('connect', (data) => {
            resolve({
                online: true
            })
            socket.end()
        })

        socket.on('error', (err) => {
            resolve({
              online: false
            })
            socket.destroy()
            reject(err)
            // ENOTFOUND = Unable to resolve.
            // ECONNREFUSED = Unable to connect to port.
        })
    })

}
