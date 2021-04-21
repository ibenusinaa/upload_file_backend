const express = require('express')
const app = express()
const mySql = require('mysql')
const cors = require('cors')
const multer = require('multer')
const deleteFiles = require('./helpers/DeleteFiles')
app.use(cors())
app.use('/images_products', express.static('images_products'))

require('dotenv').config()

const PORT = 5000

const db = mySql.createConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT

})

app.get('/', (req, res) => {
    res.status(200).send('UPLOAD FILE SYSTEM API')
})

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


let singleUpload = multer({
    storage: storage,
    fileFilter: filter,
    limis: {fileSize: 30000}}).array('images', 1)

app.post('/upload-product', (req, res) => {
    multipleUpload(req, res, (err) => {
        try {
            if(err) throw err
            if(req.files === undefined || req.files.length === 0) throw {message: 'File Not Found'}

            // Data Text  {name: ..., brand: ..., price: ..., stock: ...}
            let data = req.body.data

            // data harus di parsed dulu karena bentuknya masih string/ text biasa, diparsed jadi json/object
            let dataParsed
            try {
                dataParsed = JSON.parse(data) //data dari string jadi obj
                // console.log(dataParsed)
            } catch (error) {
                res.status(500).send({
                    error: true,
                    message: 'Data Parsing Error'
                })
            }

            let filesPathLocation = req.files.map((value) => value.path)
            console.log(filesPathLocation)
            db.beginTransaction((err) => {
                try {
                    if (err) throw err

                    db.query('INSERT INTO products SET ?', dataParsed, (err, result) => {
                        try {
                            if(err){
                                deleteFiles(filesPathLocation)

                                return db.rollback(() => {
                                    throw err
                                })
                            }
        
                            let products_id = result.insertId // products id buat dimasukin ke tabel product images
        
                            // case 1 File
                            // let imagePathLocation = `http://localhost:5000/${req.files[0].path}`
        
                            // case > 1 file image
                            let imagePathLocation = req.files.map((value) => {
                                console.log(value.path)
                                return [
                                    `http://localhost:5000/${value.path}`, products_id
                                ]
                            })
                            console.log(imagePathLocation)
        
                            // CASE KALAU 1 FILE QUERYNYA BEGINI PAKAI SET
                            // db.query('INSERT INTO product_images SET ?', {image: imagePathLocation, products_id: products_id}, (err, result) => {

                            // })
        
                            // CASE LEBIH DARI 1 FILE PAKAI VALUES 
                            db.query('INSERT INTO product_images (image, products_id) VALUES ?', [imagePathLocation], (err, result) => {
                                try {
                                    if(err){
                                        deleteFiles(filesPathLocation)

                                        return db.rollback(() => {
                                            throw err
                                        })
                                    } 

                                    db.commit((err) => {
                                        if(err){
                                            deleteFiles(filesPathLocation)

                                            return db.rollback(() => {
                                                throw err
                                            })
                                        }
                                        // kalo berhasil send status 200
                                        res.status(200).send({
                                            error: false,
                                            message: 'Upload Image Success'
                                        })
                                    })
                                    
                                } catch (error) {
                                    res.status(500).send({
                                        error: true,
                                        message: 'Image Insert Error',
                                        detail: error.message
                                    })
                                }
                            })
                        } catch (error) {
                            console.log(error)
                            res.status(500).send({
                                error: true,
                                message: 'Product Insert Error',
                                detail: error.message
                            })
                        }
                    })

                }catch (error) {
                    res.status(500).send({
                        error: true,
                        message: 'Begin Transaction Error',
                        detail: error.message
                    })
                }
            })

        } catch (error) {
            res.status(500).send({
                error: true, 
                title: 'Error Multer',
                message: error.message
            })
        }
    })
})

app.patch('/update-photo/:idImage', (req, res) => {
    singleUpload(req, res, (err) => {
        try {
            if(err) throw err
            console.log(req.files)
            if(req.files === undefined || req.files.length === 0) throw {message: 'Image not found'}
            if(req.files.length > 1) throw {message: 'Only 1 image allowed'}

            let imagePathLocation = `http://localhost:5000/${req.files[0].path}`

            let idImage = req.params.idImage

            db.beginTransaction((err) => {
                try {
                    if (err) throw err

                    db.query('SELECT image FROM product_images WHERE id = ?', idImage, (err, result) => {
                        try {
                            if(err){
                                deleteFiles(imagePathLocation)
                                return db.rollback(() => {
                                    throw err
                                })
                            }
                            let oldImagePath = [result[0].image.replace('http://localhost:5000/', '')]
                            
                            console.log(oldImagePath)
                            
                            db.query('UPDATE product_images SET image = ? WHERE id = ?', [imagePathLocation, idImage], (err2, result) => {
                                try {
                                    if(err2){
                                        deleteFiles(image)
                                        return db.rollback(() => {
                                            throw err2
                                        })
                                    }

                                    db.commit((errCommit) => {
                                        if(errCommit){
                                            return db.rollback(() => {
                                                console.log('Error Commit' + errCommit)
                                            })
                                        }
                                        
                                        deleteFiles(oldImagePath)

                                        res.status(200).send({
                                            error: false,
                                            message: 'Update Image Success'
                                        })
                                        
                                    })
                                } catch (error) {
                                    res.status(500).send({
                                        error: true,
                                        title: 'Update Image Error',
                                        error: error.message
                                    })
                                }
                            })

                        } catch (error) {
                            res.status(500).send({
                                error: true,
                                title: 'Find Image Error',
                                error: error.message
                            })
                        }
                    })
                } catch (error) {
                    res.status(500).send({
                        error: true,
                        title: 'Begin Transaction Error',
                        message: error.message
                    })
                }
            })
            
        } catch (error) {
            res.status(500).send({
                error: true,
                title: 'Error Multer',
                message: error.message
            })
        }
    })
})

app.get('/products', (req, res) => {
    db.query(`SELECT p.id, p.name, p.brand, p.price, p.stock, pi.id AS image_id, pi.image FROM products p JOIN
    product_images pi ON pi.products_id = p.id`, (err, result) => {
        try {
            if(err) throw err

            let newData = []

            result.forEach((value) => {
                let idProductExist = null

                newData.forEach((val, index) => {
                    if(val.id === value.id){
                        idProductExist = index
                    }
                })

                if(idProductExist === null){
                    newData.push(
                        {
                            id: value.id,
                            name: value.name,
                            brand: value.brand,
                            price: value.price,
                            stock: value.stock,
                            images: [
                                {
                                    image_id: value.image_id, image: value.image
                                }
                            ]
                        }
                    )
                }else{
                    newData[idProductExist].images.push(
                        {
                            image_id: value.image_id, image: value.image
                        }
                    )
                }
            })

            res.status(200).send({
                error: false,
                message: 'Get Data Success',
                data: newData
            })
        } catch (error) {
            res.status(500).send({
                error: true,
                message: 'Get Data Error',
                detail: error.message
            })
        }
    })
})

app.delete('/delete-product/:idProduct', (req, res) => {
    let idProduct = req.params.idProduct

    try {
        // step 1. Validasi id produk 
        if(!idProduct) throw {message: 'Id Product jangan null'}

        // step2. cek ada di db atau tidak
        db.query('SELECT * FROM products WHERE id =?', idProduct, (err1, result) => {
            if(err1){
                return db.rollback(() => {
                    throw err1
                })
            }

            if(result.length === 0){
                es.status(200).send({
                    error: true,
                    message: 'Product Not Found'
                })
            }

            // step 3. get path location yang lama dari DB, nanti dipake buat hapus image
            db.query('SELECT * FROM product_images WHERE products_id = ?', idProduct, (err2, result) => {
                if(err2){
                    return db.rollback(() => {
                        throw err2
                    })
                }
                
                /* hasil result:
                    result = [
                        {image: path1},
                        {image: path2},
                        {image: path3}
                    ]
                    diubah jadi:
                    [path1, path2, path3]
                */
               let imagePath = result.map((value) => {
                   return value.image.replace('http://localhost:5000/', '')
               })
               console.log(imagePath)

               db.query('DELETE FROM product_images WHERE products_id = ?', idProduct, (err3, result) => {
                   if(err3){
                       return db.rollback(() => {
                           throw err3
                       })
                   }

                   db.query('DELETE FROM products WHERE id = ?', idProduct, (err4, result) => {
                       if(err4){
                           return db.rollback(() => {
                               throw err4
                           })
                       }

                       db.commit((errCommit) => {
                           if(errCommit){
                               return db.rollback(() => {
                                   console.log('Error Commit' + errCommit)
                               })
                           }

                        //    step 4 delete old images on storage
                        deleteFiles(imagePath)

                        res.status(200).send({
                            error: false,
                            message: 'Delete Product Success'
                        })
                       })
                   })
               })

            })
        })
        
    } catch (error) {
       res.status(406).send({
           error: true,
           message: 'Validation Error',
           detail: error.message
       })
    }
})

app.listen(PORT, () => console.log('API RUNNING ON PORT ' + PORT))
