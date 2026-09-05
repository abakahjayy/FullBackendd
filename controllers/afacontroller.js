const AFARegistration = require('../models/AFAResgistration.js');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError } = require('../errors');

// POST: Create new registration
const registerAFA = async (req, res) => {
  const { fullname, idnumber, dob, phone, location, region, occupation } = req.body;
  console.log(req.body);
  if (!fullname || !idnumber || !dob || !phone || !location || !region || !occupation) {
    throw new BadRequestError('All fields are required');
  }

  const newAFA = await AFARegistration.create({
    fullname,
    idnumber,
    dob,
    phone,
    location,
    region,
    occupation,
  });

  res.status(StatusCodes.CREATED).json({
    message: 'Registration successful',
    data: newAFA,
  });
};

// GET: All registrations
const getAllAFA = async (req, res) => {
  const registrations = await AFARegistration.find().sort({ createdAt: -1 });
  res.status(StatusCodes.OK).json({ count: registrations.length, data: registrations });
};

// DELETE: One registration by ID
const deleteAFA = async (req, res) => {
  const { id } = req.params;

  const deleted = await AFARegistration.findByIdAndDelete(id);
  if (!deleted) {
    throw new NotFoundError(`No registration found with ID: ${id}`);
  }

  res.status(StatusCodes.OK).json({ message: 'Registration deleted successfully' });
};

// PUT: Update registration by ID
const updateAFA = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const updated = await AFARegistration.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!updated) {
    throw new NotFoundError(`No registration found with ID: ${id}`);
  }

  res.status(StatusCodes.OK).json({ message: 'Registration updated successfully', data: updated });
};

module.exports = {
  registerAFA,
  getAllAFA,
  deleteAFA,
  updateAFA,
};
