import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
// Material UI Imports
import { makeStyles } from '@material-ui/core/styles';
import {
  Breadcrumbs,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableContainer,
  TableRow,
  TableCell,
  Typography,
  Link,
} from '@material-ui/core';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import CloseIcon from '@material-ui/icons/Close';

// CARTO imports
import {
  WrapperWidgetUI,
  FormulaWidgetUI,
  HistogramWidgetUI,
} from '@carto/react-airship-ui';
import {
  selectSourceById,
  setViewState,
  addLayer,
  addSource,
  removeLayer,
  removeSource,
} from 'config/cartoSlice';
import { getStore, getRevenuePerMonth, getNearest } from 'models/StoreModel';
import { currencyFormatter } from 'lib/sdk';
import { SOURCE_ID, LAYER_ID, MONTHS_LABELS } from './constants';

export default function StoresDetail() {
  const [storeDetail, setStoreDetail] = useState(null);
  const [revenuePerMonth, setRevenuePerMonth] = useState(null);
  const [nearestStores, setNearestStores] = useState(null);
  const dispatch = useDispatch();
  const { id } = useParams();
  const source = useSelector((state) => selectSourceById(state, 'storesSource'));
  const navigate = useNavigate();

  const classes = useStyles();

  const histogramData = (revenuePerMonth || []).map((month) => ({
    value: month.revenue,
    tick: month.date,
  }));

  const tooltipFormatter = ([serie]) => {
    const formattedValue = currencyFormatter(serie.value);
    return `${formattedValue.unit}${formattedValue.value}`;
  };

  useEffect(() => {
    dispatch(addLayer({ id: LAYER_ID, source: SOURCE_ID, selectedStore: id }));

    dispatch(
      addSource({
        id: SOURCE_ID,
        data:
          'SELECT store_id, zip, storetype, state, revenue, the_geom_webmercator FROM mcdonalds',
      })
    );

    // Clean up when leave
    return function cleanup() {
      // mounted = false;
      dispatch(removeLayer(LAYER_ID));
      dispatch(removeSource(SOURCE_ID));
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!source) return;
    const { credentials } = source;

    // Get store detail
    getStore({ id, credentials }).then((store) => {
      const { latitude, longitude } = store;
      dispatch(setViewState({ latitude, longitude, zoom: 12, transitionDuration: 500 }));
      setStoreDetail(store);
    });

    // Get reveneue per month
    getRevenuePerMonth({ id, credentials }).then(setRevenuePerMonth);

    // Search 3 nearest in a maximum radius of 50KM (based on mercator meters, acurracy will vary on latitudes because of mercator projection)
    const maxDistance = 50000;
    const limit = 3;
    getNearest({ id, maxDistance, limit, credentials }).then(setNearestStores);
  }, [dispatch, source, id]);

  if (revenuePerMonth === null || storeDetail === null || nearestStores === null) {
    return <div>Loading</div>;
  }

  return (
    <div>
      <IconButton onClick={() => navigate('/stores')} className={classes.closeDetail}>
        <CloseIcon />
      </IconButton>

      <div className={classes.storeDetail}>
        <Breadcrumbs
          separator={<NavigateNextIcon />}
          aria-label='breadcrumb'
          gutterBottom
        >
          <Link color='inherit' component={NavLink} to='/stores'>
            All stores
          </Link>
          <Typography color='textPrimary'>Store detail</Typography>
        </Breadcrumbs>
        <Typography variant='h5' gutterBottom>
          {storeName(storeDetail)}
        </Typography>
      </div>

      <Divider />

      <WrapperWidgetUI title='Total revenue'>
        <FormulaWidgetUI formatter={currencyFormatter} data={storeDetail.revenue} />
      </WrapperWidgetUI>

      <Divider />

      <WrapperWidgetUI title='Nearest 3 stores'>
        <TableContainer>
          <Table aria-label='table with nearest stores' className={classes.storesTable}>
            <TableBody>
              {nearestStores.map((store) => {
                return (
                  <TableRow key={store.store_id}>
                    <TableCell component='th' scope='row'>
                      <Link href={`/stores/${store.store_id}`}>{storeName(store)}</Link>
                    </TableCell>
                    <TableCell align='right' className={classes.nearestDistance}>
                      {`${Math.round(store.distance / 1000)} km`}
                    </TableCell>
                    <TableCell align='right'>
                      ${currencyFormatter(store.revenue).value}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </WrapperWidgetUI>

      <Divider />

      <WrapperWidgetUI title='Revenue per month'>
        <HistogramWidgetUI
          name='Store'
          data={histogramData}
          dataAxis={MONTHS_LABELS}
          tooltipFormatter={tooltipFormatter}
        ></HistogramWidgetUI>
      </WrapperWidgetUI>
    </div>
  );
}

const useStyles = makeStyles((theme) => ({
  closeDetail: {
    position: 'absolute',
    top: theme.spacing(1.75),
    right: theme.spacing(1.75),
    color: theme.palette.primary.main,
  },
  storeDetail: {
    padding: theme.spacing(3.25, 3),
  },
  storesTable: {
    '& th, td': {
      padding: theme.spacing(1),
      borderColor: theme.palette.action.hover,
    },
  },
  nearestDistance: {
    color: theme.palette.customGrey[500],
    whiteSpace: 'nowrap',
  },
}));

function storeName(store) {
  return `${store.address}, ${store.city}`;
}
