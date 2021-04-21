const multer = require('multer')

const upload = () => {
    // Setting Multer
    // 1. Disk Storage
    let storage = multer.diskStorage({
        destination: function(req, file, next){
            next(null, 'images_products')
        },
        filename: function(req, file, next){
            // console.log(file)
            next(null, 'IMG' + '-' + Date.now() + '.' + file.mimetype.split('/')[1])
        }
    })

    // 2. file fitler
    const filter = (req, file, next) => {
        if(file.mimetype.split('/')[0] === 'image'){
            // accept
            next(null, true)

        }else if(file.mimetype.split('/')[0] !== 'image'){
            // reject
            next(new Error('File must be an image'))
        }
    }

    let multipleUpload = multer({
        storage: storage, 
        fileFilter: filter, 
        limits: {fileSize: 30000}}).array('images', 3)

        return multipleUpload
}

module.exports = upload