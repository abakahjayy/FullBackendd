const Orders = require('../models/Orders')
const { UnauthenticatedError, BadRequestError, NotFoundError } = require('../errors')
const { StatusCodes } = require('http-status-codes');
const Delivery = require('../models/Delivery');
const dayJs = require('dayjs');
const today=new dayJs();


const getAllOrders = async (req, res) => {
    const orders = await Orders.find({}).sort('-createdAt');//We want to get only the carts associated with the user
    res.status(StatusCodes.OK).json({ msg: 'Get all Orders', nbHits: orders.length, orders })
}


const getOrder = async (req, res) => {
    //Next level destructuring
    const {
        params: { id: ordersId }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    const order = await Orders.findOne({ _id: ordersId })
    if (!order) {
        throw new NotFoundError(`No order with id ${ordersId}`)
    }
    res.status(StatusCodes.OK).json({ msg: 'Order Found', nbHits: 1, order })
}


const createOrders = async (req, res) => {
    const [{orderTime,totalCostCents,products }] = req.body;
    // console.log(req.body);
    

    for (const product of products) {
        const main = await Delivery.findOne({deliveryOptionId:product.deliveryOptionId});
        if (main) {
            product.estimatedDeliveryTime =today.add(main.deliveryDays,'days').format('ddd, D MMMM YYYY');
        } else {
            console.error(`Delivery with ID ${product.deliveryOptionId} not found.`);
        }
    }
    const oldOrder = await Orders.find({})
    let isThere;
    let carProducts;
    let presentOrder;
    oldOrder.forEach((order)=>{
        // console.log(order)
        if(order.orderTime===orderTime){
            order.totalCostCents+=totalCostCents;
            presentOrder = order;
            order.products.forEach((product)=>{
                const newProId = JSON.stringify(product.productId).split('"')[1]//For the old products in the order
                products.forEach((carProduct) => {
                    const newProductId = JSON.stringify(carProduct.productId).split('"')[1]//For the products already in the cart
                    if (newProId === newProductId) {
                        isThere = true;
                        product.quantity += carProduct.quantity;
                    }else if(newProId !== newProductId){
                        // isThere = false;
                        carProducts=carProduct;
                    }
                })
                
            })
            if (!isThere&&carProducts) {
                order.products.unshift(carProducts);
            }
        }
    })
    if(presentOrder){
        presentOrder.save()
    }
    const newOrder =presentOrder?presentOrder: await Orders.create([{ orderTime,totalCostCents,products }])
    res.status(StatusCodes.CREATED).json({ msg: 'Order Created', newOrder })
}

const createOrder = async (req, res) => {
    const [{ orderTime, totalCostCents, products }] = req.body;

    // Process products to add estimated delivery times
    for (const product of products) {
        const main = await Delivery.findOne({ deliveryOptionId: product.deliveryOptionId });
        if (main) {
            product.estimatedDeliveryTime = today.add(main.deliveryDays, 'days').format('ddd, D MMMM YYYY');
        } else {
            console.error(`Delivery with ID ${product.deliveryOptionId} not found.`);
        }
    }

    // Retrieve the existing order based on orderTime
    let presentOrder = await Orders.findOne({ orderTime });

    if (presentOrder) {
        presentOrder.totalCostCents += totalCostCents;

        // Loop through the new products and find the corresponding ones in the existing order
        products.forEach((carProduct) => {
            // Use find to check if the product already exists in the present order
            const existingProduct = presentOrder.products.find(
                (product) => product.productId.toString() === carProduct.productId.toString()
            );

            if (existingProduct) {
                // If found, update the quantity
                existingProduct.quantity += carProduct.quantity;
            } else {
                // If not found, add the new product to the order
                presentOrder.products.unshift(carProduct);
            }
        });

        // Save the updated order
        await presentOrder.save();
    } else {
        // If no order matches, create a new one
        presentOrder = await Orders.create([{ orderTime, totalCostCents, products }]);
    }

    // Respond with the created/updated order
    res.status(StatusCodes.CREATED).json({ msg: 'Order Created', newOrder: presentOrder });
};



const deleteOrder = async (req, res) => {
    const {
        params: { id: ordersId }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    const order = await Orders.findByIdAndDelete({ _id: ordersId })
    if (!order) {
        throw new NotFoundError(`No order with id ${ordersId}`)
    }
    res.status(StatusCodes.OK).json({ msg: 'Order Deleted' })
}


const updateOrder = async (req, res) => {
    //Next level destructuring
    const {
        body: { totalCostCents,products },
        params: { id: orderId }//We assigned the first parameter of the params object to a new called cartId
    } = req;
    if (products === undefined) {
        throw new BadRequestError('The products fields cannot be empty')
    }
    const order = await Orders.findById({ _id: orderId })
    if (!order) {
        throw new NotFoundError(`No order with id ${orderId}`)
    }
    order.totalCostCents=totalCostCents;
    products.forEach(product => {
        console.log(product)
        order.products.unshift(product);
    });
    
    await order.save(function (err) {
        if (!err) {console.log('Success!')}
        else {
            console.log('Error');
        };
    });
    res.status(StatusCodes.OK).json({ msg: 'Order updated',nbHits: order.products.length , order });
}


module.exports = { getAllOrders, createOrder,createOrders, deleteOrder, updateOrder, getOrder }