const { UnauthenticatedError, BadRequestError, NotFoundError } = require('../errors')
const { StatusCodes } = require('http-status-codes')
const Cart = require('../models/Cart')
const Products = require('../models/Products')
const Delivery = require('../models/Delivery')
const dayJs = require('dayjs')


//?To get all the carts
//!To get all the carts
const getAllCart = async (req, res) => {
    const carts = await Cart.find({}).sort('-createdAt');//We want to get only the carts associated with the user
    res.status(StatusCodes.OK).json({ msg: 'Get all Carts', nbHits: carts.length, carts })
}



//?To get a cart
//!To get a cart
const getCart = async (req, res) => {
    const today=new dayJs()
    const date=today.format('ddd, D MMMM YYYY');
    //Next level destructuring
    const {
        params: { id: cartId }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    const cart = await Cart.findOne({ _id: cartId })
    if (!cart) {
        throw new NotFoundError(`No cart with id ${cartId}`)
    }
    res.status(StatusCodes.OK).json({ msg: 'Cart Found', nbHits: 1, cart })
}



//?To create a cart
//!To create a cart
const createCart = async (req, res) => {
    const today=new dayJs()
    const date=today.format('ddd, D MMMM YYYY');
    req.body[0].totalCartCents = 5;
    req.body[0].totalDeliveryCents = 5;
    let [{ products, totalCartCents,totalDeliveryCents }] = req.body;
    let price = 0; // Accumulator Variable
    let delivery = 0; // Accumulator Variable

    // Use for...of loop instead of forEach for async handling
    for (const product of products) {
        const main = await Products.findById(product.productId);
        if (main) {
            price += main.priceCents * product.quantity;
            console.log(price);
        } else {
            console.error(`Product with ID ${product.productId} not found.`);
        }
    } for (const product of products) {
        const main = await Delivery.findOne({deliveryOptionId:product.deliveryOptionId});
        if (main) {
            delivery += main.priceCents * 1;
            console.log(delivery);
        } else {
            console.error(`Delivery with ID ${product.deliveryOptionId} not found.`);
        }
    }

    console.log(`Final Price: ${price}`);
    console.log(`Final delivery: ${delivery}`);
    totalCartCents = Number(price); // Ensure it’s a number
    totalDeliveryCents = Number(delivery); // Ensure it’s a number
    console.log(`Total Cart Cents: ${totalCartCents}`);
    console.log(`Total Delivery Cents: ${totalDeliveryCents}`);

    // Create new cart with updated totalCartCents
    const newCart = await Cart.create([{ products, totalCartCents,totalDeliveryCents }]);
    res.status(StatusCodes.CREATED).json({ msg: 'Cart Created', newCart });
};



//?To delete a cart
//!To delete a cart
const deleteCart = async (req, res) => {
    const {
        params: { id: cartId }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    const cart = await Cart.findByIdAndDelete({ _id: cartId })
    if (!cart) {
        throw new NotFoundError(`No cart with id ${cartId}`)
    }
    res.status(StatusCodes.OK).json({ msg: 'Cart Deleted' })
}



//?To add products to a cart
//!To add products to a cart

const updateCart = async (req, res) => {
    const today=new dayJs()
    const date=today.format('ddd, D MMMM YYYY');
    //Next level destructuring
    const {
        body: { products },
        params: { id: cartId }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    if (products === undefined) {
        throw new BadRequestError('The products fields cannot be empty')
    }
    const cart = await Cart.findById({ _id: cartId })
    if (!cart) {
        throw new NotFoundError(`No cart with id ${cartId}`)
    }




    let isThere;
    products.forEach(product => {
        const newProId = JSON.stringify(product.productId).split('"')[1]//For the new products we are adding
        cart.products.forEach((carProduct) => {
            const newProductId = JSON.stringify(carProduct.productId).split('"')[1]//For the products already in the cart
            if (newProId === newProductId) {
                isThere = true;
                carProduct.quantity += product.quantity;
                carProduct.dateOrdered=date;
            }else if(newProId !== newProductId){
                // isThere = false;
            }
        })
        if (!isThere) {
            cart.products.unshift(product);
            // isThere=true;
        }
    });


    let price = 0; // Accumulator Variable
    let delivery = 0; // Accumulator Variable

    // Use for...of loop instead of forEach for async handling
    for (const product of cart.products) {
        const main = await Products.findById(product.productId);
        if (main) {
            price += main.priceCents * product.quantity;
            console.log(price);
        } else {
            console.error(`Product with ID ${product.productId} not found.`);
        }
    }
    for (const product of cart.products) {
        const main = await Delivery.findOne({deliveryOptionId:product.deliveryOptionId});
        if (main) {
            delivery += main.priceCents * 1;
            console.log(delivery);
        } else {
            console.error(`Delivery with ID ${product.deliveryOptionId} not found.`);
        }
    }

    console.log(`Final Price: ${price}`);
    console.log(`Final delivery: ${delivery}`);
    cart.totalCartCents = Number(price); // Ensure it’s a number
    cart.totalDeliveryCents = Number(delivery); // Ensure it’s a number
    if(cart.products.length ===0){
        cart.totalCartCents = 0;
        cart.totalDeliveryCents = 0;
    }
    console.log(`Total Cart Cents: ${cart.totalCartCents}`);
    console.log(`Total Delivery Cents: ${cart.totalDeliveryCents}`);


    cart.save();//This saves everything we have done to the data base
    res.status(StatusCodes.OK).json({ msg: 'Cart updated by adding products to the cart', nbHits: cart.products.length, cart });
}



//?To delete a product from  a cart
//!To delete a product from  a cart

const deleteCartProduct = async (req, res) => {
    const today=new dayJs()
    const date=today.format('ddd, D MMMM YYYY');
    //Next level destructuring
    const {
        params: { id: cartId, productId }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    // console.log(productId)
    const cart = await Cart.findById({ _id: cartId })

    if (!cart) {
        throw new NotFoundError(`No cart with id ${cartId}`)
    }
    if (!cart.products[0]) {
        cart.totalCartCents = 0
        await cart.save()
        throw new NotFoundError(`There is no product with with ${productId}`)
    }

    //Removing the product
    let isThere;
    cart.products.forEach((product, index) => {
        const newProId = JSON.stringify(product.productId).split('"')[1]
        if (newProId === productId) {
            isThere = true;
            console.log(product, index)
            cart.products.splice(index, 1);
        }
        if (index === cart.products.length - 1 && !isThere) {
            throw new NotFoundError(`There is no product with with ${productId}`)
        }
    })

    let price = 0; // Accumulator Variable
    let delivery = 0; // Accumulator Variable

    // Use for...of loop instead of forEach for async handling
    for (const product of cart.products) {
        const main = await Products.findById(product.productId);
        if (main) {
            price += main.priceCents * product.quantity;
            console.log(price);
        } else {
            console.error(`Product with ID ${product.productId} not found.`);
        }
    }
    for (const product of cart.products) {
        const main = await Delivery.findOne({deliveryOptionId:product.deliveryOptionId});
        if (main) {
            delivery += main.priceCents * 1;
            console.log(delivery);
        } else {
            console.error(`Delivery with ID ${product.deliveryOptionId} not found.`);
        }
    }

    console.log(`Final Price: ${price}`);
    console.log(`Final delivery: ${delivery}`);
    cart.totalCartCents = Number(price); // Ensure it’s a number
    cart.totalDeliveryCents = Number(delivery); // Ensure it’s a number
    if(cart.products.length ===0){
        cart.totalCartCents = 0;
        cart.totalDeliveryCents = 0;
    }
    console.log(`Total Cart Cents: ${cart.totalCartCents}`);
    console.log(`Total Delivery Cents: ${cart.totalDeliveryCents}`);


    await cart.save();
    res.status(StatusCodes.OK).json({ msg: 'Cart updated by deleting a product from the array', nbHits: cart.products.length, cart });
}




//?To change the quantity of a product in a cart
//!To change the quantity of a product in a cart

//For Changing the Quantity of the product in the cart
const changeCartQuantity = async (req, res) => {
    //Next level destructuring
    const {
        params: { id: cartId, productId, quantity }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    // console.log(productId)
    const cart = await Cart.findById({ _id: cartId })

    if (!cart) {
        throw new NotFoundError(`No cart with id ${cartId}`)
    }
    if (!cart.products[0]) {
        // cart.totalCartCents=0
        // await cart.save()
        throw new NotFoundError(`There is no product with with ${productId}`)
    }
    if (Number(quantity) <= 0) {
        throw new BadRequestError(`The quantity :${quantity} must be greater than zero`)
    }

    //Changing the quantity
    let isThere;
    cart.products.forEach((product, index) => {
        const newProId = JSON.stringify(product.productId).split('"')[1]
        if (newProId === productId) {
            isThere = true;
            // console.log(product,index)
            // cart.products.splice(index,1);
            product.quantity = Number(quantity)

        }
        if (index === cart.products.length - 1 && !isThere) {
            throw new NotFoundError(`There is no product with with ${productId}`)
        }
    })
    let price = 0; // Accumulator Variable
    let delivery = 0; // Accumulator Variable

    // Use for...of loop instead of forEach for async handling
    for (const product of cart.products) {
        const main = await Products.findById(product.productId);
        if (main) {
            price += main.priceCents * product.quantity;
            console.log(price);
        } else {
            console.error(`Product with ID ${product.productId} not found.`);
        }
    }
    for (const product of cart.products) {
        const main = await Delivery.findOne({deliveryOptionId:product.deliveryOptionId});
        if (main) {
            delivery += main.priceCents * 1;
            console.log(delivery);
        } else {
            console.error(`Delivery with ID ${product.deliveryOptionId} not found.`);
        }
    }

    console.log(`Final Price: ${price}`);
    console.log(`Final delivery: ${delivery}`);
    cart.totalCartCents = Number(price); // Ensure it’s a number
    cart.totalDeliveryCents = Number(delivery); // Ensure it’s a number
    if(cart.products.length ===0){
        cart.totalCartCents = 0;
        cart.totalDeliveryCents = 0;
    }
    console.log(`Total Cart Cents: ${cart.totalCartCents}`);
    console.log(`Total Delivery Cents: ${cart.totalDeliveryCents}`);


    await cart.save();
    res.status(StatusCodes.OK).json({ msg: 'Cart updated by changing a product quantity from the array', nbHits: cart.products.length, cart });
}


const changeDelivery = async (req, res) => {
    const {
        params: { id: cartId,productId,option }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    const today=new dayJs()
    const date=today.format('ddd, D MMMM YYYY');
    
    const cart = await Cart.findOne({ _id:cartId})
    if (!cart) {
        throw new NotFoundError(`No cart with id ${id}`)
    }
    if (!cart.products[0]) {
        // cart.totalCartCents=0
        // await cart.save()
        throw new NotFoundError(`There is no product with with ${productId}`)
    }

    //Changing the quantity
    let isThere;
    cart.products.forEach((product, index) => {
        const newProId = JSON.stringify(product.productId).split('"')[1]
        if (newProId === productId) {
            isThere = true;
            product.deliveryOptionId=option
            product.dateOrdered=date;
            // product.quantity=10
            console.log(product)
            
        }
        if (index === cart.products.length - 1 && !isThere) {
            throw new NotFoundError(`There is no product with with ${productId}`)
        }
    })
    let price = 0; // Accumulator Variable
    let delivery = 0; // Accumulator Variable

    // Use for...of loop instead of forEach for async handling
    for (const product of cart.products) {
        const main = await Products.findById(product.productId);
        if (main) {
            price += main.priceCents * product.quantity;
            console.log(price);
        } else {
            console.error(`Product with ID ${product.productId} not found.`);
        }
    }
    for (const product of cart.products) {
        const main = await Delivery.findOne({deliveryOptionId:product.deliveryOptionId});
        if (main) {
            delivery += main.priceCents * 1;
            console.log(delivery);
        } else {
            console.error(`Delivery with ID ${product.deliveryOptionId} not found.`);
        }
    }

    console.log(`Final Price: ${price}`);
    console.log(`Final delivery: ${delivery}`);
    cart.totalCartCents = Number(price); // Ensure it’s a number
    cart.totalDeliveryCents = Number(delivery); // Ensure it’s a number
    if(cart.products.length ===0){
        cart.totalCartCents = 0;
        cart.totalDeliveryCents = 0;
    }
    console.log(`Total Cart Cents: ${cart.totalCartCents}`);
    console.log(`Total Delivery Cents: ${cart.totalDeliveryCents}`);

    await cart.save();
    res.status(StatusCodes.OK).json({ msg: 'Cart Updated by changing the delivery option and the date Ordered',cart })
}


const deleteAllCartProducts = async (req, res) => {
    //Next level destructuring
    const {
        params: { id: cartId }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    // console.log(productId)
    const cart = await Cart.findById({ _id: cartId })

    if (!cart) {
        throw new NotFoundError(`No cart with id ${cartId}`)
    }
    if (!cart.products[0]) {
        cart.totalCartCents = 0
        await cart.save()
        throw new NotFoundError(`There is no products in cart`)
    }

    //Removing the product
    cart.products.forEach((product, index) => {
            cart.products.splice(index, cart.products.length);
    })

    let price = 0; // Accumulator Variable
    let delivery = 0; // Accumulator Variable

    // Use for...of loop instead of forEach for async handling
    for (const product of cart.products) {
        const main = await Products.findById(product.productId);
        if (main) {
            price += main.priceCents * product.quantity;
            console.log(price);
        } else {
            console.error(`Product with ID ${product.productId} not found.`);
        }
    }
    for (const product of cart.products) {
        const main = await Delivery.findOne({deliveryOptionId:product.deliveryOptionId});
        if (main) {
            delivery += main.priceCents * 1;
            console.log(delivery);
        } else {
            console.error(`Delivery with ID ${product.deliveryOptionId} not found.`);
        }
    }

    console.log(`Final Price: ${price}`);
    console.log(`Final delivery: ${delivery}`);
    cart.totalCartCents = Number(price); // Ensure it’s a number
    cart.totalDeliveryCents = Number(delivery); // Ensure it’s a number
    if(cart.products.length ===0){
        cart.totalCartCents = 0;
        cart.totalDeliveryCents = 0;
    }
    console.log(`Total Cart Cents: ${cart.totalCartCents}`);
    console.log(`Total Delivery Cents: ${cart.totalDeliveryCents}`);


    await cart.save();
    res.status(StatusCodes.OK).json({ msg: 'Cart updated by deleting all the products from the array', nbHits: cart.products.length, cart });
}

module.exports = {
    getAllCart,
    createCart,
    deleteCart,
    updateCart,
    getCart,
    deleteCartProduct,
    changeCartQuantity,
    changeDelivery,
    deleteAllCartProducts
}