// Component for duplicating and renaming fields across documents
import { Stack, Grid, Heading, Text, Button, TextInput, Select, Radio, Card, Box } from '@sanity/ui'
import { LockIcon, UnlockIcon } from '@sanity/icons'
import { useState, useEffect } from 'react'
import DangerModeWarning, { shouldShowDangerWarning } from './DangerModeWarning'

/**
 * Duplicate and Rename Field Component
 * Copies field values to new fields across multiple documents
 * @param {Object} props - Component props
 * @param {SanityClient} props.client - Sanity client instance
 */
const DuplicateAndRename = (props) => {
	const { client, icon: Icon, displayName, dangerMode, utilityId, onDangerModeChange } = props;
	const [ oldName, setOldName ] = useState('');
	const [ newName, setNewName ] = useState('');
	const [ duplicatable, setDuplicatable ] = useState([]);
	const [ duplicatableMessage, setDuplicatableMessage ] = useState('');
	const [ duplicateType, setDuplciateType ] = useState('typeface');
	const [ fields, setFields ] = useState([]);
	const [ lvl2Fields, setLvl2Fields ] = useState([]);
	const [ showWarningModal, setShowWarningModal ] = useState(false);
	const [ operationMode, setOperationMode ] = useState('duplicate'); // 'duplicate' or 'move'

	/**
	 * Handle danger mode toggle with warning modal
	 */
	const handleDangerModeToggle = () => {
		if (!dangerMode && shouldShowDangerWarning()) {
			// Trying to enable danger mode, show warning
			setShowWarningModal(true);
		} else {
			// Either disabling danger mode or warning is suppressed
			onDangerModeChange(utilityId, !dangerMode);
		}
	};

	const handleWarningConfirm = () => {
		setShowWarningModal(false);
		onDangerModeChange(utilityId, true);
	};

	const handleWarningCancel = () => {
		setShowWarningModal(false);
	};

	async function searchFor(value) {
		const items = await client.fetch(`*[_type == "${duplicateType}"]`)

		// Look for available keys in all items and remove the ones that are already in the object and sort alphabetically
		let keys = items.map(item => Object.keys(item))
			.flat()
			.filter((value, index, self) => self.indexOf(value) === index)
			.sort();

		// Look for available second keys in all items and remove the ones that are already in the object, label like lvl1[lvl2] and sort alphabetically
		let lvl2keys = [];
		items.forEach(item => {
			Object.keys(item).forEach(key => {
				if (typeof item[key] === 'object') {
					Object.keys(item[key]).forEach(lvl2key => {
						lvl2keys.push(`${key}[${lvl2key}]`);
					})
				}
			})
		})
		lvl2keys = lvl2keys
			.filter((value, index, self) => self.indexOf(value) === index)
			.sort();

		setFields(keys);
		setLvl2Fields(lvl2keys);
		setDuplicatable(items)
	}

	useEffect(() => {
		searchFor()
	}, [duplicateType])

	function duplicate(){
		const isMove = operationMode === 'move';
		setDuplicatableMessage(isMove ? 'Moving field...' : 'Updating data...');
		client
			.fetch(`*[_type == "${duplicateType}"]`)
			.then( async (items) => {
				let updateDataCount = 0;

				for (const item of items) {
					try {
						setDuplicatableMessage(`${isMove ? 'Moving' : 'Updating'}: ${item?.title ? item.title : item._id}`);

						// Create a new key value, where the key is the newName and the value is the oldName's value (if its empty)
						let newPair = {};
						if (oldName.includes('[')) {
							let key = oldName.split('[')[0];
							let subKey = oldName.split('[')[1].replace(']', '');
							newPair[newName] = item[key][subKey] ? item[key][subKey] : "";
						} else {
							newPair[newName] = item[oldName] ? item[oldName] : "";
						}

						// Set the new field
						await client.patch(item._id).set(newPair).commit();

						// If moving, also remove the old field
						if (isMove && !oldName.includes('[')) {
							await client.patch(item._id).unset([oldName]).commit();
						}
					} catch (e) {
						console.error(item._id, e.message)
						setDuplicatableMessage('Error: ' + e.message);
					}
					await new Promise(r => setTimeout(r, 50));

					updateDataCount++;
					if (updateDataCount == items.length - 1) {
						setDuplicatableMessage(isMove ? 'All Fields Moved!' : 'All Updated!');
						setTimeout(()=>{
							setDuplicatableMessage("");
						}, 2000)
					}
				}
			})
			.catch( (err)=>{ console.error(err) })
	}

	return (
		<>
			<DangerModeWarning
				isOpen={showWarningModal}
				onConfirm={handleWarningConfirm}
				onCancel={handleWarningCancel}
				utilityName={displayName}
			/>

			<Stack style={{paddingTop: "4em", paddingBottom: "2em", position: "relative"}}>
				<Heading as="h3" size={3}>{Icon && <Icon style={{display: 'inline-block', marginRight: '0.35em', opacity: 0.5, transform: 'translateY(2px)'}} />}{displayName}</Heading>
				<Text muted size={1} style={{paddingTop: "2em", maxWidth: "calc(100% - 100px)"}}>
					{operationMode === 'duplicate'
						? 'Copy data from an existing field to a new field name across all documents of a type. Only creates the new field if it doesn\'t already exist.'
						: 'Move data from an existing field to a new field name (copy + remove old field). The old field will be permanently deleted.'
					}
				</Text>
				<Button
					mode={dangerMode?"ghost":"bleed"}
					tone="critical"
					icon={dangerMode?UnlockIcon:LockIcon}
					onClick={handleDangerModeToggle}
					style={{cursor: "pointer", position: "absolute", bottom: "1.5em", right: "0"}}
				/>
			</Stack>

			{/* Operation Mode Selection */}
			<Stack style={{marginTop: "1em"}}>
				<Card padding={3} tone="transparent" border={1}>
					<Grid columns={[2]} gap={2}>
						<label style={{cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5em"}}>
							<Radio checked={operationMode === 'duplicate'} onChange={() => setOperationMode('duplicate')} />
							<Box>
								<Text size={1} style={{paddingBottom: ".75em"}} weight="semibold">Duplicate</Text>
								<Text size={0} muted>Copy field to new name (keeps original)</Text>
							</Box>
						</label>
						<label style={{cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5em"}}>
							<Radio checked={operationMode === 'move'} onChange={() => setOperationMode('move')} />
							<Box>
								<Text size={1} style={{paddingBottom: ".75em"}} weight="semibold">Move</Text>
								<Text size={0} muted>Copy + delete original field</Text>
							</Box>
						</label>
					</Grid>
				</Card>
			</Stack>

			<Stack style={{ position: "relative" }} >
				<Grid columns={[3]} gap={0}
					style={{
						position: "relative",
					}}
				>
					<Select
						style={{
							borderRadius: "0 3px 0 0",
						}}
						onChange={(event) => { setOldName(event.currentTarget.value) }}
						value={oldName}
					>
							<option key={`field-null`} value={false}></option>
							{fields && fields.map((field, index) => (
								<option key={`field-${index}`} value={field}>{field}</option>
							))}
							{lvl2Fields && lvl2Fields.map((field, index) => (
								<option key={`field-${index}`} value={field}>{field}</option>
							))}
					</Select>
					<TextInput
						style={{
							borderRadius: "3px 0 0 0",
						}}
						onChange={(event) => { setNewName(event.currentTarget.value) }}
						placeholder="New Name"
						value={newName}
					/>
					<Select
						style={{
							borderRadius: "0 3px 0 0",
						}}
						onChange={(event) => { setDuplciateType(event.currentTarget.value) }}
						value={duplicateType}
					>
						<option value="typeface">Typeface</option>
						<option value="collection">Collection</option>
						<option value="pair">Pair</option>
						<option value="font">Font</option>
						<option value="license">License</option>
						<option value="order">Order</option>
						<option value="account">Account</option>
						<option value="cart">Cart</option>
						<option value="page">Page</option>
						<option value="blogpost">Blogpost</option>
					</Select>
				</Grid>
			</Stack>

			{ duplicatableMessage!="" && (
				<Stack>
					<p style={{padding: ".5em 0em 1em", opacity: "0.75"}} dangerouslySetInnerHTML={{__html:  duplicatableMessage}}></p>
				</Stack>
			)}

			{ duplicatable.length > 0 && (
				<>
					<div
						style={{
							maxHeight: "400px",
							marginTop: "5px",
							border: "1px solid rgba(255,255,255,0.1)",
							overflow: "auto",
							paddingBottom: "1rem",
							borderRadius: "3px",
						}}
					>
						{ duplicatable.map((item, index) => (
							<a
								target="_blank"
								key={`item-${index}`}
								className="link"
								href={`${window.location.origin}/desk/${(duplicateType === "typeface" || duplicateType === "licenseGroup") ? "orderable-" : ""}${duplicateType};${item._id}`}
							>
								<Stack>
									<Text size={1} style={{padding: "1em 1em .5em"}}>{item.title}</Text>
								</Stack>
							</a>
						))}
					</div>
					<div style={{pointerEvents: "none", textAlign: "right", top: "-30px", paddingRight: "10px", position: "relative", height: "30px"}}>{ duplicatable.length} items</div>

					{dangerMode && (
						<Stack>
							<Button
								disabled={(newName.length && oldName.length) ? false : true}
								text={operationMode === 'move'
									? "Move Field (Copy + Delete Original)"
									: "Duplicate Field (Copy Only)"
								}
								tone="critical"
								onClick={() => { duplicate() }}
							/>
							{operationMode === 'move' && oldName.includes('[') && (
								<Text size={0} muted style={{marginTop: "0.5em"}}>
									Note: Move mode does not support nested fields (e.g., field[subfield]). The copy will be created but the original nested field cannot be automatically removed.
								</Text>
							)}
						</Stack>
					)}
				</>
			)}
		</>
	)
}

export default DuplicateAndRename
