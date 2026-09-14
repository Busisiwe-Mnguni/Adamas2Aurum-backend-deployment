import { distance } from './general.js'

function prim(graph, startId) {
	const nodeIds = Object.keys(graph)
	const inTree = new Set([startId])
	const tree = {}
	for (const id of nodeIds) tree[id] = []

	while (inTree.size < nodeIds.length) {
		let bestFrom = null
		let bestTo = null
		let bestWeight = Infinity

		for (const from of inTree) {
			for (const [to, weight] of Object.entries(
				graph[from]
			)) {
				if (!inTree.has(to) && weight < bestWeight) {
					bestWeight = weight
					bestFrom = from
					bestTo = to
				}
			}
		}

		if (bestTo === null) break
		inTree.add(bestTo)
		tree[bestFrom].push(bestTo)
		tree[bestTo].push(bestFrom)
	}

	return tree
}

function isEventCurrentlyActive(event, now = new Date()) {
	if (!event.is_active) return false
	const start = new Date(event.starts_at)
	const end = new Date(event.ends_at)
	return now >= start && now <= end
}

function buildGraph(nodes) {
	const graph = {}
	for (const a of nodes) {
		graph[a.id] = {}
		for (const b of nodes) {
			if (a.id === b.id) continue
			graph[a.id][b.id] = distance(a, b)
		}
	}
	return graph
}

function dfsPreorder(tree, startId) {
	const visited = new Set()
	const order = []

	function visit(nodeId) {
		visited.add(nodeId)
		order.push(nodeId)
		const children = [...tree[nodeId]].sort()
		for (const child of children) {
			if (!visited.has(child)) visit(child)
		}
	}

	visit(startId)
	return order
}

export function suggestEventOrder(events, playerLocation) {
	const activeEvents = events.filter((e) => isEventCurrentlyActive(e))

	const nodes = [
		{
			id: 'start',
			latitude: playerLocation.latitude,
			longitude: playerLocation.longitude,
		},
		...activeEvents.map((e) => ({
			id: String(e.event_id),
			latitude: parseFloat(e.latitude),
			longitude: parseFloat(e.longitude),
		})),
	]

	const graph = buildGraph(nodes)
	const eventsById = new Map(
		activeEvents.map((e) => [String(e.event_id), e])
	)

	const tree = prim(graph, 'start')
	const visitOrderIds = dfsPreorder(tree, 'start').filter(
		(id) => id !== 'start'
	)

	const order = []
	let currentPos = playerLocation
	let totalDistance = 0

	for (const id of visitOrderIds) {
		const event = eventsById.get(id)
		const lat = parseFloat(event.latitude)
		const lon = parseFloat(event.longitude)
		const legDistance = distance(currentPos, {
			latitude: lat,
			longitude: lon,
		})
		order.push({
			...event,
			distance_from_previous_meters: Math.round(legDistance),
		})
		totalDistance += legDistance
		currentPos = { latitude: lat, longitude: lon }
	}

	return { order, totalDistanceMeters: Math.round(totalDistance) }
}
