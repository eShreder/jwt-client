import pipe from 'lodash/fp/pipe'
import split from 'lodash/fp/split'
import slice from 'lodash/fp/slice'
import map from 'lodash/fp/map'

export const parseJSON = (value) =>
    typeof value === 'string' && value.length > 0 ? JSON.parse(value) : value

const getInfoFromB64 = pipe(
    split('.'),
    slice(0, 2),
    map(atob),
    map(parseJSON)
)

export const jwtDecode = (token = '') => {
    try {
        const [meta, data] = getInfoFromB64(token)

        return { meta, data }
    } catch (error) {
        throw new Error(error)
    }
}

export const checkToken = (token) => {
    try {
        const { data } = jwtDecode(token)

        if (data.exp * 1000 < Date.now()) {
            return undefined
        }
    } catch (error) {
        return true
    }
}
